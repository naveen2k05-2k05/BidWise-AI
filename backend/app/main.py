from datetime import date
import json

from fastapi import (
    FastAPI,
    Depends,
    UploadFile,
    File,
    HTTPException,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db
from .models import RFP, Analysis
from .schemas import RFPCreate, RFPOut
from .services import extract_document, gemini_analyze, gemini_draft


# ---------------------------------------------------------
# APP INITIALIZATION
# ---------------------------------------------------------

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BidWise AI API",
    version="0.3.0",
    description="RFP analysis, history, analytics and discovery.",
)

origins = [
    origin.strip()
    for origin in settings.cors_origins.split(",")
    if origin.strip()
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def decode_requirements(value):
    """Safely decode saved requirement JSON."""
    try:
        result = json.loads(value or "[]")
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def analysis_to_dict(row, include_text=False):
    """Serialize an analysis record consistently."""
    data = {
        "id": row.id,
        "filename": row.filename,
        "status": row.status,
        "provider_status": row.provider_status,
        "requirements": decode_requirements(row.requirements_json),
        "created_at": (
            row.created_at.isoformat()
            if row.created_at
            else None
        ),
    }

    text = row.extracted_text or ""
    data["preview"] = text[:1200]
    data["text_length"] = len(text)

    if include_text:
        data["extracted_text"] = text

    return data


def requirement_status(requirement):
    return str(requirement.get("status", "Pending Review"))


def priority_name(requirement):
    return str(requirement.get("priority", "Unknown")).title()


# ---------------------------------------------------------
# STARTUP: SYNTHETIC DEMO DATA
# ---------------------------------------------------------

@app.on_event("startup")
def seed_demo():
    from .database import SessionLocal

    db = SessionLocal()

    try:
        if db.query(RFP.id).count() == 0:
            db.add_all([
                RFP(
                    title="[DEMO] Cloud Services Modernization",
                    agency="Synthetic Demo Agency",
                    deadline="2026-11-15",
                    estimated_value="Demo value: $120k–$180k",
                    status="Analyzed",
                    description=(
                        "Synthetic example record. "
                        "Not a live opportunity."
                    ),
                    qualification_score=82,
                    is_demo=True,
                ),
                RFP(
                    title="[DEMO] Secure Data Platform RFP",
                    agency="Synthetic Demo Department",
                    deadline="2026-11-28",
                    estimated_value="Demo value: $75k–$100k",
                    status="New",
                    description=(
                        "Synthetic example record. "
                        "Not a live opportunity."
                    ),
                    qualification_score=64,
                    is_demo=True,
                ),
            ])
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "BidWise AI API",
        "ai_configured": bool(settings.gemini_api_key),
    }


# ---------------------------------------------------------
# RFP RECORDS
# ---------------------------------------------------------

@app.get("/api/rfps", response_model=list[RFPOut])
def list_rfps(
    q: str = Query(default="", max_length=200),
    status: str | None = Query(default=None, max_length=40),
    include_demo: bool = True,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(RFP)

    if q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                RFP.title.ilike(term),
                RFP.agency.ilike(term),
                RFP.description.ilike(term),
            )
        )

    if status and status.strip():
        query = query.filter(RFP.status == status.strip())

    if not include_demo:
        query = query.filter(RFP.is_demo.is_(False))

    return (
        query.order_by(desc(RFP.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


@app.post("/api/rfps", response_model=RFPOut)
def create_rfp(
    payload: RFPCreate,
    db: Session = Depends(get_db),
):
    item = RFP(**payload.model_dump(), is_demo=False)

    try:
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save the RFP record.",
        )


@app.delete("/api/rfps/{rfp_id}")
def delete_rfp(
    rfp_id: int,
    db: Session = Depends(get_db),
):
    item = db.get(RFP, rfp_id)

    if item is None:
        raise HTTPException(status_code=404, detail="RFP not found")

    if item.is_demo:
        raise HTTPException(
            status_code=403,
            detail="Synthetic demo records are protected.",
        )

    try:
        db.delete(item)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not delete the RFP record.",
        )

    return {"deleted": True, "id": rfp_id}


# ---------------------------------------------------------
# DISCOVERY: SEARCH SAVED OPPORTUNITIES
# ---------------------------------------------------------

@app.get("/api/discovery")
def discover_rfps(
    q: str = Query(default="", max_length=200),
    status: str | None = Query(default=None, max_length=40),
    min_score: int | None = Query(default=None, ge=0, le=100),
    max_score: int | None = Query(default=None, ge=0, le=100),
    include_demo: bool = True,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Discover opportunities already saved in the database."""
    if (
        min_score is not None
        and max_score is not None
        and min_score > max_score
    ):
        raise HTTPException(
            status_code=422,
            detail="min_score cannot exceed max_score.",
        )

    query = db.query(RFP)

    if q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                RFP.title.ilike(term),
                RFP.agency.ilike(term),
                RFP.description.ilike(term),
            )
        )

    if status and status.strip():
        query = query.filter(RFP.status == status.strip())

    if min_score is not None:
        query = query.filter(
            RFP.qualification_score >= min_score
        )

    if max_score is not None:
        query = query.filter(
            RFP.qualification_score <= max_score
        )

    if not include_demo:
        query = query.filter(RFP.is_demo.is_(False))

    total = query.count()

    rows = (
        query.order_by(desc(RFP.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "id": row.id,
                "title": row.title,
                "agency": row.agency,
                "deadline": row.deadline,
                "estimated_value": row.estimated_value,
                "status": row.status,
                "description": row.description,
                "qualification_score": row.qualification_score,
                "is_demo": row.is_demo,
                "created_at": (
                    row.created_at.isoformat()
                    if row.created_at
                    else None
                ),
            }
            for row in rows
        ],
        "source_note": (
            "Results are saved database records, not live "
            "external procurement listings."
        ),
    }


# ---------------------------------------------------------
# DASHBOARD SUMMARY
# ---------------------------------------------------------

@app.get("/api/summary")
def summary(db: Session = Depends(get_db)):
    total = db.query(func.count(RFP.id)).scalar() or 0

    new_count = (
        db.query(func.count(RFP.id))
        .filter(RFP.status == "New")
        .scalar()
        or 0
    )

    analyzing_count = (
        db.query(func.count(RFP.id))
        .filter(RFP.status == "Analyzing")
        .scalar()
        or 0
    )

    qualified_count = (
        db.query(func.count(RFP.id))
        .filter(RFP.qualification_score >= 70)
        .scalar()
        or 0
    )

    demo_count = (
        db.query(func.count(RFP.id))
        .filter(RFP.is_demo.is_(True))
        .scalar()
        or 0
    )

    analysis_count = (
        db.query(func.count(Analysis.id)).scalar() or 0
    )

    return {
        "total_rfps": total,
        "new_opportunities": new_count,
        "under_analysis": analyzing_count,
        "qualified": qualified_count,
        "demo_records": demo_count,
        "total_analyses": analysis_count,
        "ai_configured": bool(settings.gemini_api_key),
    }


# ---------------------------------------------------------
# HISTORY: SEARCH AND PAGINATE ANALYSES
# ---------------------------------------------------------

@app.get("/api/analyses")
def list_analyses(
    q: str = Query(default="", max_length=200),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Analysis)

    if q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(Analysis.filename.ilike(term))

    total = query.count()

    rows = (
        query.order_by(desc(Analysis.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [analysis_to_dict(row) for row in rows],
    }


@app.get("/api/analyses/{analysis_id}")
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
):
    row = db.get(Analysis, analysis_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis record not found.",
        )

    return analysis_to_dict(row, include_text=True)


@app.delete("/api/analyses/{analysis_id}")
def delete_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
):
    row = db.get(Analysis, analysis_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis record not found.",
        )

    try:
        db.delete(row)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not delete the analysis record.",
        )

    return {"deleted": True, "id": analysis_id}


# ---------------------------------------------------------
# REVIEW: SAVE REQUIREMENT REVIEW STATUS
# ---------------------------------------------------------

@app.patch("/api/analyses/{analysis_id}/requirements/{requirement_id}")
def update_requirement_status(
    analysis_id: int,
    requirement_id: str,
    status: str = Query(...),
    db: Session = Depends(get_db),
):
    allowed_statuses = {
        "Pending Review",
        "Compliant",
        "Partially Compliant",
        "Non-Compliant",
        "Needs Review",
        "Approved",
    }

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Unsupported review status.",
                "allowed_statuses": sorted(allowed_statuses),
            },
        )

    row = db.get(Analysis, analysis_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis record not found.",
        )

    requirements = decode_requirements(row.requirements_json)

    target = next(
        (
            item
            for item in requirements
            if str(item.get("id", "")).casefold()
            == requirement_id.casefold()
        ),
        None,
    )

    if target is None:
        raise HTTPException(
            status_code=404,
            detail="Requirement not found in this analysis.",
        )

    target["status"] = status

    try:
        row.requirements_json = json.dumps(
            requirements,
            ensure_ascii=False,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save the requirement review status.",
        )

    return {
        "analysis_id": analysis_id,
        "requirement_id": requirement_id,
        "status": status,
    }


# ---------------------------------------------------------
# ANALYTICS: REAL ANALYSIS AND REQUIREMENT METRICS
# ---------------------------------------------------------

@app.get("/api/analytics")
def analytics(db: Session = Depends(get_db)):
    total_analyses = (
        db.query(func.count(Analysis.id)).scalar() or 0
    )

    # Only retrieve the fields needed for analytics.
    rows = (
        db.query(
            Analysis.id,
            Analysis.created_at,
            Analysis.requirements_json,
        )
        .order_by(Analysis.created_at.asc())
        .all()
    )

    total_requirements = 0
    mandatory_count = 0
    optional_count = 0
    priority_counts = {}
    review_counts = {}
    daily_activity = {}

    for row in rows:
        day = (
            row.created_at.date().isoformat()
            if row.created_at
            else "Unknown"
        )
        daily_activity[day] = daily_activity.get(day, 0) + 1

        requirements = decode_requirements(
            row.requirements_json
        )

        for requirement in requirements:
            total_requirements += 1

            mandatory = requirement.get("mandatory", False)
            is_mandatory = (
                mandatory is True
                or str(mandatory).strip().lower()
                in {"yes", "true", "mandatory"}
            )

            if is_mandatory:
                mandatory_count += 1
            else:
                optional_count += 1

            priority = priority_name(requirement)
            priority_counts[priority] = (
                priority_counts.get(priority, 0) + 1
            )

            status = requirement_status(requirement)
            review_counts[status] = (
                review_counts.get(status, 0) + 1
            )

    reviewed_count = sum(
        count
        for status, count in review_counts.items()
        if status in {"Compliant", "Partially Compliant",
                      "Non-Compliant", "Approved"}
    )

    pending_count = total_requirements - reviewed_count

    rfp_status_rows = (
        db.query(RFP.status, func.count(RFP.id))
        .group_by(RFP.status)
        .all()
    )

    rfp_status_counts = {
        status or "Unknown": count
        for status, count in rfp_status_rows
    }

    return {
        "total_analyses": total_analyses,
        "total_rfps": (
            db.query(func.count(RFP.id)).scalar() or 0
        ),
        "total_requirements": total_requirements,
        "mandatory_requirements": mandatory_count,
        "optional_requirements": optional_count,
        "reviewed_requirements": reviewed_count,
        "pending_requirements": pending_count,
        "review_completion_percent": (
            round(reviewed_count / total_requirements * 100, 1)
            if total_requirements
            else 0
        ),
        "priority_breakdown": priority_counts,
        "review_status_breakdown": review_counts,
        "rfp_status_breakdown": rfp_status_counts,
        "daily_activity": [
            {"date": day, "count": count}
            for day, count in sorted(daily_activity.items())
        ],
        "generated_at": date.today().isoformat(),
        "note": (
            "Metrics are calculated from saved records. "
            "Requirement review status is not an independent "
            "security or compliance certification."
        ),
    }


# ---------------------------------------------------------
# AI-POWERED PDF/DOCX ANALYSIS
# ---------------------------------------------------------

@app.post("/api/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    filename = file.filename or "upload"

    if not filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(
            status_code=415,
            detail="Unsupported file. Upload PDF or DOCX.",
        )

    max_bytes = settings.max_upload_mb * 1024 * 1024

    content = await file.read(max_bytes + 1)

    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File exceeds {settings.max_upload_mb} MB limit."
            ),
        )

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    try:
        extracted, pages = extract_document(filename, content)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not extract document text: "
                f"{str(exc)[:200]}"
            ),
        ) from exc

    if not extracted.strip():
        raise HTTPException(
            status_code=422,
            detail=(
                "No searchable text found. Scanned PDFs need OCR; "
                "OCR is not included."
            ),
        )

    try:
        ai_result = await gemini_analyze(extracted, filename)

        requirements = ai_result["requirements"]
        document_type = ai_result["document_type"]
        is_rfp = ai_result["is_rfp"]
        summary_text = ai_result["summary"]
        warnings = ai_result["warnings"]

        if not isinstance(requirements, list):
            raise ValueError("AI returned an invalid requirements list.")

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"AI analysis unavailable: {str(exc)[:250]}",
        ) from exc

    
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=502,
            detail=(
                f"AI analysis failed: "
                f"{type(exc).__name__}: {str(exc)[:500]}"
            ),
        ) from exc


    record = Analysis(
        filename=filename,
        extracted_text=extracted,
        requirements_json=json.dumps(
            requirements,
            ensure_ascii=False,
        ),
        status="Analyzed by AI",
        provider_status="Gemini AI",
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=(
                "AI analysis succeeded, but saving the result failed."
            ),
        ) from exc

    return {
        "id": record.id,
        "filename": filename,
        "status": record.status,
        "provider_status": record.provider_status,
        "document_type": document_type,
        "is_rfp": is_rfp,
        "summary": summary_text,
        "warnings": warnings,
        "requirements": requirements,
        "preview": extracted[:1200],
        "page_count": len(pages),
    }


# ---------------------------------------------------------
# AI RESPONSE DRAFTING
# ---------------------------------------------------------

@app.post("/api/draft")
async def draft_response(payload: dict):
    requirement = str(payload.get("requirement", "")).strip()
    evidence = str(payload.get("evidence", "")).strip()

    if not requirement:
        raise HTTPException(
            status_code=400,
            detail="Requirement is required.",
        )

    try:
        answer = await gemini_draft(requirement, evidence)

        return {
            "draft": answer,
            "provider": settings.gemini_model,
            "grounding": (
                "Uses only the evidence supplied; "
                "reviewer verification required."
            ),
        }

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"AI service unavailable: {str(exc)[:250]}",
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "AI provider request failed: "
                f"{str(exc)[:180]}"
            ),
        ) from exc

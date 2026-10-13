from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Boolean
from sqlalchemy.sql import func
from .database import Base

class RFP(Base):
    __tablename__ = "rfps"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    agency = Column(String(200), default="Not specified")
    deadline = Column(String(40), default="")
    estimated_value = Column(String(80), default="")
    status = Column(String(40), default="New")
    source_url = Column(String(1000), default="")
    description = Column(Text, default="")
    qualification_score = Column(Float, default=0)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(Integer, primary_key=True, index=True)
    rfp_id = Column(Integer, nullable=True)
    filename = Column(String(300), nullable=False)
    extracted_text = Column(Text, default="")
    requirements_json = Column(Text, default="[]")
    status = Column(String(40), default="Extracted")
    provider_status = Column(String(100), default="Not configured")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

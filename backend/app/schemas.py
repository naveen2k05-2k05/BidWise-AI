from pydantic import BaseModel, Field
from typing import Optional

class RFPCreate(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    agency: str = "Not specified"
    deadline: str = ""
    estimated_value: str = ""
    status: str = "New"
    source_url: str = ""
    description: str = ""

class RFPOut(RFPCreate):
    id: int
    qualification_score: float
    is_demo: bool
    class Config:
        from_attributes = True

class AnalysisOut(BaseModel):
    id: int
    filename: str
    status: str
    provider_status: str
    requirements: list
    preview: str

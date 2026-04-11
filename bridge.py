from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import os
from engine import run_crew

app = FastAPI(title="Digital Godfather Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

class PromptRequest(BaseModel):
    prompt: str
    filename: str = "output.txt"

class StatusResponse(BaseModel):
    status: str
    result: str
    filename: str

@app.get("/")
def root():
    return {"status": "Digital Godfather is running", "version": "1.0"}

@app.post("/run", response_model=StatusResponse)
async def run_agent(request: PromptRequest):
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            run_crew,
            request.prompt,
            request.filename
        )
        return StatusResponse(
            status="success",
            result=result,
            filename=request.filename
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok", "ollama": "http://localhost:11434"}

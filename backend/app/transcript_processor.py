from pydantic import BaseModel
from typing import List, Tuple, Literal

import logging
import os
from urllib.parse import urlparse
from dotenv import load_dotenv
from db import DatabaseManager
import asyncio
from ollama import AsyncClient





# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()  # Load environment variables from .env file

db = DatabaseManager()

def approved_ollama_host() -> str:
    """Return a loopback-only Ollama base URL for the hardened legacy backend."""
    candidate = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").strip()
    parsed = urlparse(candidate)
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("OLLAMA_HOST must use HTTP or HTTPS")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("OLLAMA_HOST must not contain credentials, query parameters, or fragments")
    if parsed.path not in {"", "/"}:
        raise ValueError("OLLAMA_HOST must not contain an API path")
    if hostname not in {"localhost", "127.0.0.1", "::1", "host.docker.internal"}:
        raise ValueError("The hardened backend permits Ollama on the local host only")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port != 11434:
        raise ValueError("The hardened backend permits the local Ollama port 11434 only")
    return candidate.rstrip("/")

class Block(BaseModel):
    """Represents a block of content in a section.
    
    Block types must align with frontend rendering capabilities:
    - 'text': Plain text content
    - 'bullet': Bulleted list item
    - 'heading1': Large section heading
    - 'heading2': Medium section heading
    
    Colors currently supported:
    - 'gray': Gray text color
    - '' or any other value: Default text color
    """
    id: str
    type: Literal['bullet', 'heading1', 'heading2', 'text']
    content: str
    color: str  # Frontend currently only uses 'gray' or default

class Section(BaseModel):
    """Represents a section in the meeting summary"""
    title: str
    blocks: List[Block]

class MeetingNotes(BaseModel):
    """Represents the meeting notes"""
    meeting_name: str
    sections: List[Section]

class People(BaseModel):
    """Represents the people in the meeting. Always have this part in the output. Title - Person Name (Role, Details)"""
    title: str
    blocks: List[Block]

class SummaryResponse(BaseModel):
    """Represents the meeting summary response based on a section of the transcript"""
    MeetingName : str
    People : People
    SessionSummary : Section
    CriticalDeadlines: Section
    KeyItemsDecisions: Section
    ImmediateActionItems: Section
    NextSteps: Section
    MeetingNotes: MeetingNotes

# --- Main Class Used by main.py ---

class TranscriptProcessor:
    """Handles the processing of meeting transcripts using AI models."""
    def __init__(self):
        """Initialize the transcript processor."""
        logger.info("TranscriptProcessor initialized.")
        self.db = DatabaseManager()
        self.active_clients = []  # Track active Ollama client sessions
    async def process_transcript(self, text: str, model: str, model_name: str, chunk_size: int = 5000, overlap: int = 1000, custom_prompt: str = "") -> Tuple[int, List[str]]:
        """
        Process transcript text into chunks and generate structured summaries for each chunk using an AI model.

        Args:
            text: The transcript text.
            model: The AI model provider. The hardened backend accepts 'ollama' only.
            model_name: The specific model name.
            chunk_size: The size of each text chunk.
            overlap: The overlap between consecutive chunks.
            custom_prompt: A custom prompt to use for the AI model.

        Returns:
            A tuple containing:
            - The number of chunks processed.
            - A list of JSON strings, where each string is the summary of a chunk.
        """

        logger.info(
            "Processing transcript metadata: length=%s, provider=%s, chunk_size=%s, overlap=%s",
            len(text), model, chunk_size, overlap
        )

        all_json_data = []
        try:
            # The hardened legacy backend supports local Ollama only. Cloud
            # provider credentials and calls are handled by the desktop app
            # under Confidential Mode policy and OS keychain protection.
            if model != "ollama":
                raise ValueError("The hardened legacy backend supports local Ollama only")

            approved_ollama_host()
            if model_name.lower().startswith("phi4") or model_name.lower().startswith("llama"):
                chunk_size = 10000
                overlap = 1000
            else:
                chunk_size = 30000
                overlap = 1000
            logger.info("Using approved local Ollama model")

            # Split transcript into chunks
            step = chunk_size - overlap
            if step <= 0:
                logger.warning(f"Overlap ({overlap}) >= chunk_size ({chunk_size}). Adjusting overlap.")
                overlap = max(0, chunk_size - 100)
                step = chunk_size - overlap

            chunks = [text[i:i+chunk_size] for i in range(0, len(text), step)]
            num_chunks = len(chunks)
            logger.info(f"Split transcript into {num_chunks} chunks.")

            for i, chunk in enumerate(chunks):
                logger.info(f"Processing chunk {i+1}/{num_chunks}...")
                try:
                    logger.info(
                        "Using local Ollama summary model for chunk %s/%s",
                        i + 1,
                        num_chunks,
                    )
                    response = await self.chat_ollama_model(model_name, chunk, custom_prompt)
                    if isinstance(response, SummaryResponse):
                        final_summary_pydantic = response
                    else:
                        final_summary_pydantic = SummaryResponse.model_validate_json(response)

                    # Convert the Pydantic model to a JSON string
                    chunk_summary_json = final_summary_pydantic.model_dump_json()
                    all_json_data.append(chunk_summary_json)
                    logger.info(f"Successfully generated summary for chunk {i+1}.")

                except Exception as chunk_error:
                    logger.error("Error processing chunk %s; error_type=%s", i + 1, type(chunk_error).__name__)

            logger.info(f"Finished processing all {num_chunks} chunks.")
            return num_chunks, all_json_data

        except Exception as e:
            logger.error("Transcript processing failed; error_type=%s", type(e).__name__)
            raise
    
    async def chat_ollama_model(self, model_name: str, transcript: str, custom_prompt: str):
        message = {
        'role': 'system',
        'content': f'''
        Given the following meeting transcript chunk, extract the relevant information according to the required JSON structure. If a specific section (like Critical Deadlines) has no relevant information in this chunk, return an empty list for its 'blocks'. Ensure the output is only the JSON data.

        Transcript Chunk:
            ---
            {transcript}
            ---
        Please capture all relevant action items. Transcription can have spelling mistakes. correct it if required. context is important.
        
        While generating the summary, please add the following context:
        ---
        {custom_prompt}
        ---

        Make sure the output is only the JSON data.
    
        ''',
        }

        # Create a client and track it for cleanup
        ollama_host = approved_ollama_host()
        client = AsyncClient(host=ollama_host)
        self.active_clients.append(client)
        
        try:
            response = await client.chat(model=model_name, messages=[message], stream=True, format=SummaryResponse.model_json_schema())
            
            full_response = ""
            async for part in response:
                content = part['message']['content']
                full_response += content
            
            try:
                summary = SummaryResponse.model_validate_json(full_response)
                logger.info("Validated structured Ollama summary response")
                return summary
            except Exception as e:
                logger.warning("Ollama response did not match the structured summary schema")
                return full_response
        except asyncio.CancelledError:
            logger.info("Ollama request was cancelled during shutdown")
            raise
        except Exception as e:
            logger.error("Local Ollama request failed; error_type=%s", type(e).__name__)
            raise
        finally:
            # Remove the client from active clients list
            if client in self.active_clients:
                self.active_clients.remove(client)

    def cleanup(self):
        """Clean up resources used by the TranscriptProcessor."""
        logger.info("Cleaning up TranscriptProcessor resources")
        try:
            # Close database connections if any
            if hasattr(self, 'db') and self.db is not None:
                # self.db.close()
                logger.info("Database connection cleanup (using context managers)")
                
            # Cancel any active Ollama client sessions
            if hasattr(self, 'active_clients') and self.active_clients:
                logger.info(f"Terminating {len(self.active_clients)} active Ollama client sessions")
                for client in self.active_clients:
                    try:
                        # Close the client's underlying connection
                        if hasattr(client, '_client') and hasattr(client._client, 'close'):
                            asyncio.create_task(client._client.aclose())
                    except Exception as client_error:
                        logger.error(f"Error closing Ollama client: {client_error}", exc_info=True)
                # Clear the list
                self.active_clients.clear()
                logger.info("All Ollama client sessions terminated")
        except Exception as e:
            logger.error(f"Error during TranscriptProcessor cleanup: {str(e)}", exc_info=True)

        
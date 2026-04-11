from crewai import Agent, Task, Crew
from crewai_tools import FileWriterTool
import os

os.environ["OPENAI_API_KEY"] = "NA"

file_tool = FileWriterTool()

business_agent = Agent(
    role="Business Automation Expert",
    goal="Analyze startup ideas and generate detailed business documents",
    backstory="Expert startup consultant who creates actionable business plans and documents",
    tools=[file_tool],
    llm_config={
        "config_list": [{
            "model": "llama3.2",
            "base_url": "http://localhost:11434/v1",
            "api_key": "NA"
        }]
    },
    verbose=True
)

def run_crew(prompt: str, filename: str = "output.txt"):
    task = Task(
        description=f"""
        {prompt}
        
        Write the complete result to a file named '{filename}'.
        Make it detailed, actionable, and India-market focused.
        """,
        expected_output=f"A detailed business document saved to {filename}",
        agent=business_agent
    )
    
    crew = Crew(
        agents=[business_agent],
        tasks=[task],
        verbose=True
    )
    
    result = crew.kickoff()
    return str(result)

if __name__ == "__main__":
    result = run_crew("Create a business plan for a food delivery startup in Mumbai", "business_plan.txt")
    print("Done:", result)

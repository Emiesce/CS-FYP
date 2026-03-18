from openai import AzureOpenAI
import time

class AzureLLM:
    def __init__(self, api_key, endpoint, model="gpt-4o-mini"):
        self.client = AzureOpenAI(
            api_key=api_key,
            api_version="2024-10-21",
            azure_endpoint=endpoint,
        )
        self.model = model

    def chat(self, messages, temperature=0.3):
        for attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature
                )

                return response.choices[0].message.content.strip()

            except RateLimitError:
                    time.sleep(1.5 * (attempt + 1))

        return "LLM temporarily unavailable."
  

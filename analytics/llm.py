from openai import AzureOpenAI

class AzureLLM:
    def __init__(self, api_key, endpoint, model="gpt-4o-mini"):
        self.client = AzureOpenAI(
            api_key=api_key,
            api_version="2024-10-21",
            azure_endpoint=endpoint,
        )
        self.model = model

    def summarize(self, texts):
        """
        texts: list[str] OR single str
        returns: summary string
        """

        if isinstance(texts, list):
            content = "\n".join(f"- {t}" for t in texts if t.strip())
        else:
            content = texts

        prompt = f"""
You are an education analytics assistant.

Summarize the following student feedbacks into
clear, concise misconceptions or insights.

Feedbacks:
{content}
"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        return response.choices[0].message.content.strip()

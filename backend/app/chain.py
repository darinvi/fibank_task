from functools import lru_cache

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI

SYSTEM_PROMPT = (
    "You are a helpful assistant for Fibank. "
    "Answer clearly and concisely."
)


@lru_cache
def get_chat_chain() -> Runnable:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", "{input}"),
        ]
    )
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    return prompt | llm | StrOutputParser()


def run_chat(message: str) -> str:
    return get_chat_chain().invoke({"input": message})

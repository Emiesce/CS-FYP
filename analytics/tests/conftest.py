import importlib
import sys
import types

import pytest


@pytest.fixture()
def dummy_db():
    return object()


@pytest.fixture()
def ai_service(mocker):
    """
    Construct AIService with AzureLLM mocked so tests are offline/fast.
    """
    import services.ai_services as mod

    fake_llm = mocker.Mock()
    mocker.patch.object(mod, "AzureLLM", autospec=True, return_value=fake_llm)
    return mod.AIService()


@pytest.fixture()
def llm_mod(mocker):
    """
    Import services.llm with AzureOpenAI patched to a fake client.
    Ensures all AzureLLM tests stay offline and deterministic.
    """
    mod = importlib.import_module("services.llm")
    mocker.patch.object(mod, "AzureOpenAI", autospec=True, return_value=mocker.Mock())
    return mod


@pytest.fixture()
def import_question_analytics_services(mocker):
    """
    `services.question_analytics_services` instantiates a SentenceTransformer at import time.
    We inject a tiny fake `sentence_transformers` module into sys.modules so tests are fast/offline.
    """

    fake_model = mocker.Mock()
    fake_sentence_transformers = types.ModuleType("sentence_transformers")

    def _fake_sentence_transformer(_name):
        return fake_model

    fake_sentence_transformers.SentenceTransformer = _fake_sentence_transformer

    # Ensure a clean import each time (and that our fake gets used).
    sys.modules["sentence_transformers"] = fake_sentence_transformers
    sys.modules.pop("services.question_analytics_services", None)

    mod = importlib.import_module("services.question_analytics_services")
    return mod, fake_model


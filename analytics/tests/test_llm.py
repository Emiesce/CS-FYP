import pytest


def test_init_constructs_azure_client_with_expected_args(mocker, llm_mod):
    fake_client = mocker.Mock()
    llm_mod.AzureOpenAI.return_value = fake_client

    llm = llm_mod.AzureLLM(api_key="k", endpoint="https://example.azure.com", model="gpt-x")

    llm_mod.AzureOpenAI.assert_called_once_with(
        api_key="k",
        api_version="2024-10-21",
        azure_endpoint="https://example.azure.com",
    )
    assert llm.client is fake_client
    assert llm.model == "gpt-x"


def test_chat_success_returns_stripped_content_and_calls_create(mocker, llm_mod):
    llm = llm_mod.AzureLLM(api_key="k", endpoint="https://example.azure.com", model="gpt-x")
    llm.client = mocker.Mock()

    response = mocker.Mock()
    response.choices = [mocker.Mock(message=mocker.Mock(content="  hello  \n"))]
    llm.client.chat.completions.create.return_value = response

    messages = [{"role": "user", "content": "hi"}]
    result = llm.chat(messages, temperature=0.9)

    llm.client.chat.completions.create.assert_called_once_with(
        model="gpt-x",
        messages=messages,
        temperature=0.9,
    )
    assert result == "hello"


def test_chat_retries_on_rate_limit_error_and_backs_off(mocker, llm_mod):
    class FakeRateLimitError(Exception):
        pass

    mocker.patch.object(llm_mod, "RateLimitError", FakeRateLimitError)
    sleep = mocker.patch.object(llm_mod.time, "sleep", autospec=True)

    llm = llm_mod.AzureLLM(api_key="k", endpoint="https://example.azure.com", model="gpt-x")
    llm.client = mocker.Mock()

    response = mocker.Mock()
    response.choices = [mocker.Mock(message=mocker.Mock(content="ok"))]
    llm.client.chat.completions.create.side_effect = [
        FakeRateLimitError(),
        FakeRateLimitError(),
        response,
    ]

    assert llm.chat([{"role": "user", "content": "hi"}]) == "ok"

    assert llm.client.chat.completions.create.call_count == 3
    assert [c.args[0] for c in sleep.call_args_list] == [1.5, 3.0]


def test_chat_returns_fallback_after_three_rate_limit_errors(mocker, llm_mod):
    class FakeRateLimitError(Exception):
        pass

    mocker.patch.object(llm_mod, "RateLimitError", FakeRateLimitError)
    sleep = mocker.patch.object(llm_mod.time, "sleep", autospec=True)

    llm = llm_mod.AzureLLM(api_key="k", endpoint="https://example.azure.com", model="gpt-x")
    llm.client = mocker.Mock()
    llm.client.chat.completions.create.side_effect = FakeRateLimitError()

    assert llm.chat([{"role": "user", "content": "hi"}]) == "LLM temporarily unavailable."

    assert llm.client.chat.completions.create.call_count == 3
    assert [c.args[0] for c in sleep.call_args_list] == [1.5, 3.0, 4.5]


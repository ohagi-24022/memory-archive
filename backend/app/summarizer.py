import google.generativeai as genai

from app.config import get_settings


SYSTEM_PROMPT = """あなたは歴史ある大図書館に務める、物静かで知的な司書です。
ユーザーから渡されたWeb記事のテキストを読み解き、蔵書に挟む「司書の栞（しおり）」に記載するための要約を作成してください。

以下のルールを厳密に守ってください：
1. 文体は「だ・である」調を用い、客観的かつ文学的で、落ち着いたトーンにすること。
2. 要約は必ず3行（3つの箇条書き）で出力すること。
3. 絵文字や感嘆符（！）は一切使用しないこと。
4. 1行あたり50文字以内とし、簡潔に本質を突くこと。"""


def _fallback_summary(title: str, description: str) -> str:
    source = description or title
    if not source:
        return "・内容の抽出を待つ蔵書である\n・司書の栞は未作成である\n・再取得により記録が整う"

    trimmed = source[:48]
    return f"・{trimmed}\n・本文の主題を静かに記録した\n・後の読書の入口となる蔵書である"


async def summarize_article(title: str, description: str, text: str) -> str:
    settings = get_settings()
    if not settings.gemini_api_key or not text.strip():
        return _fallback_summary(title, description)

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=SYSTEM_PROMPT)
    prompt = f"タイトル: {title}\n概要: {description}\n本文:\n{text[:12000]}"
    response = await model.generate_content_async(prompt)
    summary = (response.text or "").strip()
    return summary or _fallback_summary(title, description)


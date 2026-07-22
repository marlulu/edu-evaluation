from __future__ import annotations

import re
from enum import Enum
from pydantic import BaseModel, Field


class RuleKind(str, Enum):
    EXPLICIT_SCORE = "explicit_score"
    SUBMISSION_CONSTRAINT = "submission_constraint"
    QUALITATIVE = "qualitative"
    CONTEXT = "context"


class RuleClause(BaseModel):
    id: str
    kind: RuleKind
    text: str
    score: float | None = None


class InterpretedRules(BaseModel):
    clauses: list[RuleClause] = Field(default_factory=list)


def interpret_rules(rule_text: str) -> InterpretedRules:
    clauses: list[RuleClause] = []
    parts = [item.strip() for item in re.split(r"[\n；;。]", rule_text or "") if item.strip()]
    for index, text in enumerate(parts, 1):
        score_match = re.search(r"(\d+(?:\.\d+)?)\s*分", text)
        if score_match:
            kind = RuleKind.EXPLICIT_SCORE
            score = float(score_match.group(1))
        elif re.search(r"提交|上传|文件|格式|附件|不少于|至少|必须", text):
            kind, score = RuleKind.SUBMISSION_CONSTRAINT, None
        elif re.search(r"完整|清晰|质量|逻辑|主题|规范|表达|创意", text):
            kind, score = RuleKind.QUALITATIVE, None
        else:
            kind, score = RuleKind.CONTEXT, None
        clauses.append(RuleClause(id=f"rule-{index}", kind=kind, text=text, score=score))
    return InterpretedRules(clauses=clauses)

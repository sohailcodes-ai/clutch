import { eq } from 'drizzle-orm';
import { schema } from '@clutch/db';
/** Reference evaluator: compares trimmed stdout to expected output. Swap for sandbox runner in production. */
export async function evaluateSubmission(db, submissionId) {
    const submission = await db.query.submissions.findFirst({
        where: eq(schema.submissions.id, submissionId),
        with: {
            match: true,
        },
    });
    if (!submission)
        return null;
    const tests = await db.query.testCases.findMany({
        where: eq(schema.testCases.questionVersionId, submission.questionVersionId),
        orderBy: (fields, { asc }) => asc(fields.ordinal),
    });
    await db
        .update(schema.submissions)
        .set({ status: 'running', totalCount: tests.length })
        .where(eq(schema.submissions.id, submissionId));
    let passed = 0;
    let totalTime = 0;
    for (const test of tests) {
        const started = Date.now();
        let status = 'accepted';
        let stdout = '';
        let stderr = '';
        try {
            stdout = runReferenceSolution(submission.sourceCode, submission.language, test.input);
            const ok = stdout.trim() === test.expectedOutput.trim();
            status = ok ? 'accepted' : 'wrong_answer';
            if (ok)
                passed += test.weight;
        }
        catch (err) {
            status = 'runtime_error';
            stderr = err instanceof Error ? err.message : 'runtime error';
        }
        const elapsed = Date.now() - started;
        totalTime += elapsed;
        await db.insert(schema.submissionRuns).values({
            submissionId,
            testCaseId: test.id,
            status,
            stdout,
            stderr,
            executionTimeMs: elapsed,
        });
        await db
            .update(schema.submissions)
            .set({ passedCount: passed, status })
            .where(eq(schema.submissions.id, submissionId));
    }
    const finalStatus = passed >= tests.reduce((sum, t) => sum + (t.weight ?? 1), 0) ? 'accepted' : 'wrong_answer';
    await db
        .update(schema.submissions)
        .set({
        status: finalStatus,
        passedCount: passed,
        executionTimeMs: totalTime,
    })
        .where(eq(schema.submissions.id, submissionId));
    return db.query.submissions.findFirst({ where: eq(schema.submissions.id, submissionId) });
}
function runReferenceSolution(sourceCode, language, input) {
    void language;
    void sourceCode;
    const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0)
        return '0';
    const nums = lines.map(Number).filter((n) => !Number.isNaN(n));
    if (nums.length === 0)
        return '0';
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1)
        return String(sorted[mid]);
    return String(Math.floor((sorted[mid - 1] + sorted[mid]) / 2));
}
//# sourceMappingURL=runner.js.map
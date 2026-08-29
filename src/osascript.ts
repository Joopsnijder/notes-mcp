import { execFile } from "child_process";

/**
 * Run a JXA script. The script goes in over stdin rather than an -e argument,
 * so nothing in it has to survive shell quoting; callers embed values with
 * JSON.stringify, which is a valid JavaScript literal.
 */
export async function executeOSAScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = execFile(
            "osascript",
            ["-l", "JavaScript", "-"],
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Failed to execute osascript: ${error.message}`));
                    return;
                }
                if (stderr) {
                    reject(new Error(`osascript error: ${stderr}`));
                    return;
                }
                resolve(stdout);
            }
        );

        child.stdin?.end(script);
    });
}

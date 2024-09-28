import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import ignore, { Ignore } from "ignore";

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand(
        "extension.generateFolderStructure",
        () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;

            if (workspaceFolders) {
                const folderPath = workspaceFolders[0].uri.fsPath;

                vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: "GFS: ",
                        cancellable: false,
                    },
                    async (progress) => {
                        progress.report({
                            message: `Generating Folder Structure...`,
                        });

                        clearLogFile(folderPath); // Clear and prepare the gfs_logs.txt file
                        createGfsIgnoreFile(folderPath); // Ensure .gfs_ignore exists
                        createGfsIncludeFile(folderPath); // Ensure .gfs_include exists

                        const structure = generateFileStructure(
                            folderPath,
                            calculateIgnoreRules(folderPath)
                        );
                        if (structure) {
                            writeToFile(structure);
                        }
                    }
                );
            } else {
                logMessage("No workspace folder is open.", "ERROR");
                vscode.window.showErrorMessage(
                    "GFS: No workspace folder is open."
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}

function clearLogFile(directoryPath: string) {
    const docsPath = path.join(directoryPath, "docs", "gfs");
    const logFilePath = path.join(docsPath, "gfs_logs.txt");

    try {
        if (fs.existsSync(logFilePath)) {
            fs.unlinkSync(logFilePath); // Remove if exists
        }
        // Create a new empty log file
        fs.writeFileSync(logFilePath, "", "utf-8");
    } catch (error: unknown) {
        console.error(`Failed to clear log file: ${getErrorMessage(error)}`);
    }
}

function createGfsIgnoreFile(directoryPath: string) {
    const docsPath = path.join(directoryPath, "docs", "gfs");
    const gfsIgnorePath = path.join(docsPath, ".gfs_ignore");

    try {
        if (!fs.existsSync(docsPath)) {
            fs.mkdirSync(docsPath, { recursive: true });
        }

        if (!fs.existsSync(gfsIgnorePath)) {
            const defaultPatterns: string[] = [
                ".vs",
                ".vscode",
                "node_modules",
				".git",
				"gfs"
            ];
            fs.writeFileSync(
                gfsIgnorePath,
                defaultPatterns.join("\n"),
                "utf-8"
            );
            logMessage(
                "Created .gfs_ignore. You can extend this with more ignore patterns.",
                "INFO"
            );
            vscode.window.showInformationMessage(
                "GFS: Created .gfs_ignore. You can extend this with more ignore patterns."
            );
        }
    } catch (error: unknown) {
        logMessage(
            `Error creating .gfs_ignore: ${getErrorMessage(error)}`,
            "ERROR"
        );
        vscode.window.showErrorMessage(
            `GFS: Error creating .gfs_ignore: ${getErrorMessage(error)}`
        );
    }
}

function createGfsIncludeFile(directoryPath: string) {
    const docsPath = path.join(directoryPath, "docs", "gfs");
    const gfsIncludePath = path.join(docsPath, ".gfs_include");

    try {
        if (!fs.existsSync(gfsIncludePath)) {
            const defaultPatterns: string[] = []; // You can add default patterns if needed
            fs.writeFileSync(
                gfsIncludePath,
                defaultPatterns.join("\n"),
                "utf-8"
            );
            logMessage(
                "Created .gfs_include. You can add patterns to override exclusions.",
                "INFO"
            );
            vscode.window.showInformationMessage(
                "GFS: Created .gfs_include. You can add patterns to override exclusions."
            );
        }
    } catch (error: unknown) {
        logMessage(
            `Error creating .gfs_include: ${getErrorMessage(error)}`,
            "ERROR"
        );
        vscode.window.showErrorMessage(
            `GFS: Error creating .gfs_include: ${getErrorMessage(error)}`
        );
    }
}

function calculateIgnoreRules(directoryPath: string): Ignore {
    const gitIgnorePath = path.join(directoryPath, ".gitignore");
    const gfsIgnorePath = path.join(
        directoryPath,
        "docs",
        "gfs",
        ".gfs_ignore"
    );
    const gfsIncludePath = path.join(
        directoryPath,
        "docs",
        "gfs",
        ".gfs_include"
    );

    const ig = ignore();

    // Collect include patterns from .gfs_include
    const _include_ig = ignore();
    loadPatternsFromFile(gfsIncludePath, _include_ig, ((el:string)=>el.trim()));

    // Load exclusion patterns first from .gitignore and .gfs_ignore
    loadPatternsFromFile(gitIgnorePath, ig,((el:string)=>el.trim().replace(/\r$/, '')), _include_ig);
    loadPatternsFromFile(gfsIgnorePath, ig, ((el:string)=>el.trim()),_include_ig);

    // Return the tuple
    return ig;
}

function loadPatternsFromFile(
    filePath: string,
    patterns: Ignore,
    cleanHandler: (el: string) => string,
	include_patterns?: Ignore
) {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
		const loadedPatterns = content
			.split("\n")
			.filter((line) => cleanHandler(line) !== "" && !line.startsWith("#"))
			.map(e => cleanHandler(e));

        if (include_patterns) {
            loadedPatterns.forEach((pattern) => {
                !include_patterns.ignores(pattern) && patterns.add(pattern);
            });
        } else {
            patterns.add(loadedPatterns);
        }
    } else {
        logMessage(`File does not exist: ${filePath}`, "ERROR");
    }
}

function generateFileStructure(
    directoryPath: string,
    ig: Ignore,
    depth: number = 0
): string | null {
    let structure = "";
    let files: string[];

    try {
        files = fs.readdirSync(directoryPath);
    } catch (error: unknown) {
        logMessage(
            `Error reading directory ${directoryPath}: ${getErrorMessage(
                error
            )}`,
            "ERROR"
        );
        vscode.window.showErrorMessage(
            `GFS: Error reading directory: ${getErrorMessage(error)}`
        );
        return null;
    }

    const directories: string[] = [];
    const filesList: string[] = [];

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        let stat;

        try {
            stat = fs.statSync(filePath);
        } catch (error: unknown) {
            logMessage(
                `Error getting stats for ${filePath}: ${getErrorMessage(
                    error
                )}`,
                "ERROR"
            );
            vscode.window.showErrorMessage(
                `GFS: Error getting stats for ${filePath}: ${getErrorMessage(
                    error
                )}`
            );
            continue; // Skip this file or directory
        }

        // Check if the file should be ignored
        const shouldIgnore = ig.ignores(file);

        if (shouldIgnore) {
            logMessage(`Ignoring: ${file}`, "INFO");
            continue;
        }

        if (stat.isDirectory()) {
            directories.push(file);
        } else if (stat.isFile()) {
            filesList.push(file);
        }
    }

    // Sort directories and files alphabetically
    directories.sort();
    filesList.sort();

    for (const dir of directories) {
        structure += `${"  ".repeat(depth)}[${dir}]\n`;
        const subStructure = generateFileStructure(
            path.join(directoryPath, dir),
            ig,
            depth + 1
        );
        if (subStructure) {
            structure += subStructure;
        }
    }

    // Add files after directories
    for (const file of filesList) {
        structure += `${"  ".repeat(depth)}- ${file}\n`;
    }

    return structure;
}

function writeToFile(content: string) {
    const docsPath = path.join(
        vscode.workspace.workspaceFolders![0].uri.fsPath,
        "docs"
    );
    const filePath = path.join(docsPath, "project_structure.txt");

    try {
        fs.writeFileSync(filePath, content, "utf-8");
        logMessage(`Folder Structure generated.`, "INFO");
        vscode.window.showInformationMessage(
            `GFS: Folder Structure generated.`
        );
    } catch (error: unknown) {
        logMessage(
            `Error writing to project_structure.txt: ${getErrorMessage(error)}`,
            "ERROR"
        );
        vscode.window.showErrorMessage(
            `GFS: Error while generating Structure: ${getErrorMessage(error)}`
        );
    }
}

function logMessage(message: string, logType: "ERROR" | "INFO") {
    const docsPath = path.join(
        vscode.workspace.workspaceFolders![0].uri.fsPath,
        "docs",
        "gfs"
    );
    const logFilePath = path.join(docsPath, "gfs_logs.txt");

    // Check if gfs_logs.txt exists and create if it doesn't
    try {
        if (!fs.existsSync(logFilePath)) {
            fs.writeFileSync(logFilePath, "", "utf-8"); // Create a new empty log file
        }

        const logMessage = `${new Date().toISOString()} [${logType}]: ${message}\n`;
        fs.appendFileSync(logFilePath, logMessage, "utf-8");
    } catch (error: unknown) {
        console.error(`Failed to write to log file: ${getErrorMessage(error)}`);
    }
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "An unknown error occurred";
}

export function deactivate() {}

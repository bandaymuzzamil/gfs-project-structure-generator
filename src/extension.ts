import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import ignore, { Ignore } from "ignore";

// This function is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
    // Register the command to generate folder structure
    const disposable = vscode.commands.registerCommand(
        "extension.generateFolderStructure",
        () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;

            // Ensure there's an open workspace folder
            if (workspaceFolders) {
                const folderPath = workspaceFolders[0].uri.fsPath;

                // Show progress notification while generating folder structure
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

                        // Prepare log and ignore files
                        clearLogFile(folderPath); // Clear the log file
                        createGfsIgnoreFile(folderPath); // Create .gfs_ignore if it doesn't exist
                        createGfsIncludeFile(folderPath); // Create .gfs_include if it doesn't exist

                        // Generate the folder structure and write it to a file
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

    context.subscriptions.push(disposable); // Dispose of the command on extension deactivation
}

// Clears the gfs_logs.txt file and creates a new one
function clearLogFile(directoryPath: string) {
    const docsPath = path.join(directoryPath, "docs", "gfs");
    const logFilePath = path.join(docsPath, "gfs_logs.txt");

    try {
        if (fs.existsSync(logFilePath)) {
            fs.unlinkSync(logFilePath); // Remove existing log file
        }
        fs.writeFileSync(logFilePath, "", "utf-8"); // Create a new empty log file
    } catch (error: unknown) {
        console.error(`Failed to clear log file: ${getErrorMessage(error)}`);
    }
}

// Creates the .gfs_ignore file with default patterns if it doesn't exist
function createGfsIgnoreFile(directoryPath: string) {
    const docsPath = path.join(directoryPath, "docs", "gfs");
    const gfsIgnorePath = path.join(docsPath, ".gfs_ignore");

    try {
        if (!fs.existsSync(docsPath)) {
            fs.mkdirSync(docsPath, { recursive: true }); // Create the gfs directory if it doesn't exist
        }

        if (!fs.existsSync(gfsIgnorePath)) {
            const defaultPatterns: string[] = [
                ".vs",
                ".vscode",
                "node_modules",
                ".git",
                "gfs",
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

// Creates the .gfs_include file if it doesn't exist
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

// Calculates ignore rules based on .gitignore and .gfs_ignore files
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
    loadPatternsFromFile(gfsIncludePath, _include_ig, (el: string) =>
        el.trim()
    );

    // Load exclusion patterns from .gitignore and .gfs_ignore
    loadPatternsFromFile(
        gitIgnorePath,
        ig,
        (el: string) => el.trim().replace(/\r$/, ""),
        _include_ig
    );
    loadPatternsFromFile(
        gfsIgnorePath,
        ig,
        (el: string) => el.trim(),
        _include_ig
    );

    return ig; // Return the ignore rules
}

// Loads patterns from a file and adds them to the Ignore instance
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
            .filter(
                (line) => cleanHandler(line) !== "" && !line.startsWith("#")
            )
            .map(cleanHandler);

        // Add patterns to the Ignore instance based on inclusion rules
        if (include_patterns) {
            loadedPatterns.forEach((pattern) => {
                if (!include_patterns.ignores(pattern)) {
                    patterns.add(pattern);
                }
            });
        } else {
            patterns.add(loadedPatterns); // Add all loaded patterns
        }
    } else {
        logMessage(`File does not exist: ${filePath}`, "ERROR");
    }
}

// Generates the folder structure as a string
function generateFileStructure(
    directoryPath: string,
    ig: Ignore,
    depth: number = 0
): string | null {
    let structure = "";
    let files: string[];

    try {
        files = fs.readdirSync(directoryPath); // Read directory contents
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
        return null; // Return null on error
    }

    const directories: string[] = []; // Array to hold directory names
    const filesList: string[] = []; // Array to hold file names

    // Iterate through files to separate directories and files
    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        let stat;

        try {
            stat = fs.statSync(filePath); // Get file stats
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
        if (ig.ignores(file)) {
            logMessage(`Ignoring: ${file}`, "INFO");
            continue; // Skip ignored files
        }

        // Sort directories and files into separate arrays
        if (stat.isDirectory()) {
            directories.push(file);
        } else if (stat.isFile()) {
            filesList.push(file);
        }
    }

    // Sort directories and files alphabetically
    directories.sort();
    filesList.sort();

    // Build the structure string with directories and files
    for (const dir of directories) {
        structure += `${"  ".repeat(depth)}[${dir}]\n`; // Indent and add directory
        const subStructure = generateFileStructure(
            path.join(directoryPath, dir),
            ig,
            depth + 1
        );
        if (subStructure) {
            structure += subStructure; // Append subdirectory structure
        }
    }

    // Add files after directories
    for (const file of filesList) {
        structure += `${"  ".repeat(depth)}- ${file}\n`; // Indent and add file
    }

    return structure; // Return the complete structure
}

// Writes the generated structure to a file
function writeToFile(content: string) {
    const filePath = path.join(
        vscode.workspace.workspaceFolders![0].uri.fsPath,
        "docs",
        "project_structure.txt"
    );

    try {
        fs.writeFileSync(filePath, content, "utf-8"); // Write content to file
        logMessage(`Folder structure written to: ${filePath}`, "INFO");
        vscode.window.showInformationMessage(
            `GFS: Folder Structure generated.`
        );
    } catch (error: unknown) {
        logMessage(
            `Error writing to file ${filePath}: ${getErrorMessage(error)}`,
            "ERROR"
        );
        vscode.window.showErrorMessage(
            `GFS: Error writing to file: ${getErrorMessage(error)}`
        );
    }
}

// Logs messages to gfs_logs.txt
function logMessage(message: string, level: "INFO" | "ERROR") {
    const logFilePath = path.join(
        vscode.workspace.workspaceFolders![0].uri.fsPath,
        "docs",
        "gfs",
        "gfs_logs.txt"
    );

    try {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}]: ${message}\n`;
        fs.appendFileSync(logFilePath, logEntry, "utf-8"); // Append log entry
    } catch (error: unknown) {
        console.error(`Failed to write to log file: ${getErrorMessage(error)}`);
    }
}

// Helper function to get error messages from unknown types
function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// This method is called when your extension is deactivated
export function deactivate() {}

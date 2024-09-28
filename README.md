# GFS (Generate Folder Structure) Extension for Visual Studio Code

## Overview

The GFS extension is designed to help users generate a structured overview of their project directories in Visual Studio Code. It provides functionality for ignoring specific files and directories, as well as logging actions taken by the extension, enhancing project management and organization.

## Features

- **Generate Folder Structure**: Quickly create a hierarchical view of your project's directory structure.
- **Ignore Patterns**: Utilize `.gfs_ignore` and `.gfs_include` files to manage which files and directories should be excluded from the folder structure generation.
- **Logging**: All actions and errors are logged in `gfs_logs.txt`, providing visibility into the extension's operations.

## Usage

### Command

To generate the folder structure, use the command:

```
GFS: Generate
```

### Functionality

1. **Folder Structure Generation**:
   - The extension scans the currently open workspace folder and generates a structured view of its contents.
   - The generated structure will be saved to `project_structure.txt` under the `docs` directory.

2. **Ignore and Include Patterns**:
   - The extension supports two special files:
     - **`.gfs_ignore`**: Lists patterns for files and directories to be ignored. By default, it includes common directories like `.git`, `node_modules`, and more. You can extend this list with additional patterns as needed.
     - **`.gfs_include`**: Allows you to override the exclusion rules defined in `.gfs_ignore`. If a file matches a pattern in this file, it will be included regardless of other ignore rules.

3. **Logging**:
   - Actions and errors are recorded in `gfs_logs.txt`. This file is cleared each time the command is run, ensuring that it only contains logs from the latest operation.
   - The log entries include timestamps and severity levels (INFO or ERROR) to help you track the extension’s behavior.

### File Generation

When you run the command, the following files are created or updated in your workspace:

- **`project_structure.txt`**: Contains the generated folder structure of your project.
- **`.gfs_ignore`**: Created if it doesn’t already exist, containing default ignore patterns.
- **`.gfs_include`**: Created if it doesn’t already exist, allowing you to specify which files to include.
- **`gfs_logs.txt`**: Logs actions and errors that occur during execution.

## Installation

1. Open Visual Studio Code.
2. Go to the Extensions view (Ctrl+Shift+X).
3. Search for `"GFS (Generate Folder Structure)"` and click "Install."
4. Once installed, open a workspace folder to start using the extension.

## Troubleshooting

If you encounter issues while using the extension:

- Check `gfs_logs.txt` for error messages and logs that can help identify problems.
- Ensure that your workspace folder is correctly set and contains the expected files and directories.
- Verify that your `.gfs_ignore` and `.gfs_include` files are correctly formatted.

## Contribution

Feel free to contribute to the extension by opening issues or pull requests. Your feedback is highly appreciated!

## License

This extension is licensed under the MIT License. See the LICENSE file for more details.

import * as vscode from 'vscode';

function GetPatternRange(regex: RegExp | string, sign: string): Object[] | undefined {
    let editor = vscode.window.activeTextEditor;
    if (editor !== undefined) {
        if (editor.document.languageId !== 'go') {
            vscode.window.showInformationMessage('file in the active editor is not a go file(*.go)');
            return undefined;
        }
        let selection = editor.selection;
        let selectline = selection.active.line;
        
        let sstart = sign[0];
        let send = sign[1];

        for (let i = selectline; i >= 0; i--) {
            let lineText = editor.document.lineAt(i);
            let matches = lineText.text.match(regex);
            
            if (matches !== null) {
                let open = 0;
                
                BREAK_OPEN: for (let n = i; n < editor.document.lineCount; n++) {
                    let lineText = editor.document.lineAt(n);
                    for (let c = 0; c < lineText.text.length; c++) {
                        switch (lineText.text[c]) {
                            case sstart:
                                open++;
                                break;
                            case send:
                                open--;
                                if (open === 0) {
                                    if (n >= selectline) {
                                        return [matches, i, n];
                                    }
                                    break BREAK_OPEN;
                                }
                                break;
                        }
                    }
                }
                break;
            }
        }
    }
}


export { GetPatternRange };
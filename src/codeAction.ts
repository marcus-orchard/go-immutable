import * as vscode from 'vscode';

export class Provider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        // throw new Error("Method not implemented.");
        let actions: vscode.CodeAction[] = [];

        let action = new vscode.CodeAction(`Go Immutable`, vscode.CodeActionKind.Source);
     
        action.command = {
            title: "Go Immutable",
            command: "go-immutable.Go-Get-With"
        } as vscode.Command;
        actions.push(action);
        action.isPreferred =  true;
        
        return actions;       
    } 
}
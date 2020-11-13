

import { stringify } from 'querystring';
import * as vscode from 'vscode';
// import { Provider } from './codeAction';
import { StructInfo, Field, GeneratorType, SelectedDecorationType} from './base';
import { GetPatternRange } from './utils';

let typeMap = new Map<string, GeneratorType>();
let typeCharMap = new Map<GeneratorType, string>();



typeMap.set("Getter", GeneratorType.Getter);
typeMap.set("Wither", GeneratorType.Wither);
typeCharMap.set(GeneratorType.Getter, "G");
typeCharMap.set(GeneratorType.Wither, "W");
typeCharMap.set(GeneratorType.Getter | GeneratorType.Wither, "GW");


function commandSetterGetter() {
    // Display a message box to the user
    let sinfo = GetStruct();
    let editor = vscode.window.activeTextEditor;
    if (sinfo && editor) {

        let decoration = <vscode.DecorationOptions>{ range: new vscode.Range(sinfo.Range[0], 0, sinfo.Range[1] + 1, 0) };
        editor.setDecorations(SelectedDecorationType, [decoration]);

        vscode.window.showQuickPick(["Getter", "Wither"], <vscode.QuickPickOptions>{ canPickMany: true, placeHolder: "select getter and/or wither" }).then(items => {
            console.log(items);

            if (items) {
                let myitems = items as any as string[];
                let gtype = GeneratorType.Unknown;
                myitems.forEach((value) => {
                    let sel = typeMap.get(value);
                    if (sel) {
                        gtype = gtype | sel;
                    }
                });
                if (sinfo) {
                    GeneratorGetWith(sinfo, gtype);
                }
            }

            let editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.setDecorations(SelectedDecorationType, []);
            }
        });
    } else {
        vscode.window.showErrorMessage("there is no struct(go) to focus. please move cursor in the code of struct.");
    }
}


function GeneratorGetWith(sinfo: StructInfo, stype: GeneratorType) {

    console.log(sinfo);

    let editor = vscode.window.activeTextEditor;
    if (editor !== undefined) {

        let gtypechar = typeCharMap.get(stype) as string;
        let regexFunction = `^func {0,}\\(.+${sinfo.Name} {0,}\\) {0,}[${gtypechar}]et([a-zA-Z_]+) {0,}\\(`;
        let existsStructFunctions: Set<string> = new Set<string>();
        for (let n = 0; n < editor.document.lineCount; n++) {
            let line = editor.document.lineAt(n);
            let matches = line.text.match(regexFunction);
            if (matches !== null) {
                existsStructFunctions.add(matches[1]);
            }
        }

        const options = <vscode.QuickPickOptions>{ canPickMany: true, placeHolder: "select the fields that would be generator get with" };
        var items: vscode.QuickPickItem[] = [];

        var obj = {
            info: sinfo,
            exists: existsStructFunctions,

            fields2items: function () {
                this.info.Fields.forEach((value, key) => {
                    if (this.exists.has(key)) {
                        vscode.window.showInformationMessage("Get" + key + " or With" + key + " Exists");
                    } else {
                        items.push(<vscode.QuickPickItem>{
                            label: value.toString(),
                            detail: this.info.Name,
                            description: key,
                        });
                    }
                });
            },

            pick: function () {
                this.fields2items();
                if (items.length) {
                    vscode.window.showQuickPick(items, options).then((item) => {
                        if (item) {
                            let fields = item as any as vscode.QuickPickItem[];
                            let sname = getAbbreviation(this.info.Name) as string;
                            let structString = `func (${sname} ${this.info.Name})`;

                            fields.forEach((qitem) => {
                                let field = this.info.Fields.get(qitem.description as string);

                                if (field) {

                                    let editor = vscode.window.activeTextEditor;
                                    if (editor) {

                                        let keyName = field.Name[0].toUpperCase() + field.Name.substr(1);
                                        let keyNameLower = keyName[0].toLowerCase() + keyName.slice(1);
                                        let keyNameSingular = keyName
                                        if (keyNameSingular.slice(keyNameSingular.length - 1) == "s") {
                                            keyNameSingular = keyNameSingular.slice(0, -1)
                                        }
                                        let keyNameSingularLower = keyNameSingular[0].toLowerCase() + keyNameSingular.slice(1);

                                        let functionName = field.Parent.replace(new RegExp("\\.", "g"), "") + keyName;

                                        // With
                                        if (stype & GeneratorType.Wither) {
                                            if (field.Type[0] == "[") {
                                                let arrType = field.Type.substring(2)

                                                let withFunc = `With${keyNameSingular}At`
                                                let withSS = new vscode.SnippetString(
                                                    `\n// ${withFunc} returns a copy with the ${arrType} at the given index of ${keyNameLower}\n${structString} ${withFunc}(i int, item ${arrType}) ${this.info.Name} {\n\t${sname}${field.Parent}${field.Name} = append(${sname}${field.Parent}${field.Name}[:i], append([]${arrType}{item}, ${sname}${field.Parent}${field.Name}[i+1:]...)...)\n\treturn ${sname}\n}\n`
                                                )
                                                editor.insertSnippet(withSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                            } else if (field.Type.slice(0, 4) == "map["){
                                                let mapTypes = getKeyValue(field.Type)
                                                let keyType = mapTypes[0]
                                                let valueType = mapTypes[1]
          
                                                let withFunc = `With${keyName}`
                                                let withSS = new vscode.SnippetString(
                                                    `\n// ${withFunc} returns a copy with the ${valueType} with the given key ${keyType}\n${structString} ${withFunc}(key ${keyType}, value ${valueType}) ${this.info.Name} {\n\t${sname}${field.Parent}${field.Name}[key] = value\n\treturn ${sname}\n}\n`
                                                )
                                                editor.insertSnippet(withSS, new vscode.Position(this.info.Range[1] + 1, 0))

                                            } else {
                                                let prefix = "With";
                                                let setFunction = prefix + functionName;
                                                let params = `(${field.Name} ${field.Type})`;
                                                let comment = `\n// ${setFunction} returns a copy with the given ${field.Type} ${field.Name}`;
                                                let ss = new vscode.SnippetString(
                                                    `${comment}\n${structString} ${setFunction}${params} ${this.info.Name}{\n\t${sname}${field.Parent}${field.Name} = ${field.Name}\n\treturn ${sname}\n}\n`);
                                                editor.insertSnippet(ss, new vscode.Position(this.info.Range[1] + 1, 0));
                                            }

                                        }

                                        if (stype & GeneratorType.Getter) {
                                            if (field.Type[0] == "[") {
                                                let arrType = field.Type.substring(2)

                                                let numFunc = `Num${keyName}`
                                                let numSS = new vscode.SnippetString(
                                                    `\n// ${numFunc} returns the number of ${keyNameLower} of type ${arrType}\n${structString} ${numFunc}() int {\n\treturn len(${sname}${field.Parent}${field.Name})\n}\n`
                                                )
                                                editor.insertSnippet(numSS, new vscode.Position(this.info.Range[1] + 1, 0))

                                                let atFunc = `${keyNameSingular}At`
                                                let atSS = new vscode.SnippetString(
                                                    `\n// ${atFunc} returns the ${keyNameSingularLower} of type ${arrType} at the requested index\n${structString} ${atFunc}(i int) ${field.Type.substring(2)} {\n\treturn ${sname}${field.Parent}${field.Name}[i]\n}\n`
                                                )
                                                editor.insertSnippet(atSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                            } else if (field.Type.slice(0, 4) == "map["){
                                                let mapTypes = getKeyValue(field.Type)
                                                let keyType = mapTypes[0]
                                                let valueType = mapTypes[1]

                                                let atFunc = `${keyNameSingular}At`
                                                let atSS = new vscode.SnippetString(
                                                    `\n// ${atFunc} returns the ${keyNameSingularLower} of type ${valueType} at the requested key\n${structString} ${atFunc}(key ${keyType}) ${valueType} {\n\treturn ${sname}${field.Parent}${field.Name}[key]\n}\n`
                                                )
                                                editor.insertSnippet(atSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                            } else {
                                                let prefix = "Get";
                                                let getFunction = prefix + functionName;
                                                let comment = `\n// ${getFunction} returns the ${field.Type} ${field.Name} \n`;
                                                let ss = new vscode.SnippetString(`${comment}${structString} ${getFunction}() ${field.Type} {\n\treturn ${sname}${field.Parent}${field.Name}\n}\n`);
                                                editor.insertSnippet(ss, new vscode.Position(this.info.Range[1] + 1, 0));
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            }
        };

        obj.pick();
    }
}

function GetStruct(): StructInfo | undefined {
    let result = GetPatternRange("type +([^ ]+) +struct", "{}");
    if (result) {
        let editor = vscode.window.activeTextEditor as any;
        let matches: RegExpMatchArray = result[0] as RegExpMatchArray;
        let startline = result[1] as number;
        let endline = result[2] as number;
        return new StructInfo(matches[1], getStructField(editor, "", startline, endline), [startline, endline]);
    }
}

function getStructField(editor: vscode.TextEditor, parent: string, startline: number, endline: number): Field[] {

    let result: Field[] = [];

    if (endline - startline <= 1) {
        return result;
    }

    parent += ".";

    let regex = "([^ \t]+)[ \t]+([^ \\(\\{\t]+)";
    for (let i = startline + 1; i < endline; i++) {
        let textline = editor.document.lineAt(i);
        let matchArray = textline.text.match(regex);

        if (matchArray !== null) {
            var end: number;
            let fieldName = matchArray[matchArray.length - 2];
            let fieldType = matchArray[matchArray.length - 1].trim();

            switch (fieldType) {
                case 'struct':
                    end = getFieldRange(editor, ['{', '}'], i, endline);
                    if (i === end) {
                        function getSingleStructRelationship(source: string, parent: string): Field | undefined {
                            let smatch = source.match("([^ \t]+)[^s]+struct {0,}\\{(.+)\\}");
                            if (smatch !== null) {
                                return getSingleStructRelationship(smatch[2], parent + "." + smatch[1]);
                            } else {
                                smatch = source.match("([^ \t]+)[ \t]+(.+)");
                                if (smatch !== null) {
                                    return new Field(parent + ".", smatch[2].trim(), smatch[1], [i, end]);
                                }
                            }
                        }

                        let v = getSingleStructRelationship(textline.text, "");
                        if (v !== undefined) {
                            result.push(v);
                        }
                    } else {
                        result = result.concat(getStructField(editor, parent + fieldName, i, end));
                        i = end;
                    }
                    break;
                case 'interface':
                    result.push(new Field(parent, fieldType + "{}", fieldName, [i, i]));
                    break;
                case 'func':
                    end = getFieldRange(editor, ['(', ')'], i, endline);
                    if (i === end) {
                        let matches = textline.text.match("func\\(.+");
                        if (matches !== null) {
                            result.push(new Field(parent, matches[0].trim(), fieldName, [i, end]));
                        }
                    } else {
                        i = end;
                    }
                    break;
                default:
                    result.push(new Field(parent, fieldType, fieldName, [i, i]));
                    break;
            }
        }
    }

    return result;
}

// getAbbreviation 
function getAbbreviation(name: string): string | undefined {
    if (name.length) {
        let shortName = name[0].toLowerCase();
        return shortName
    }
    return undefined;
}


function getFieldRange(editor: vscode.TextEditor, pair: string[], startline: number, endline: number): number {

    let open = 0;
    let start = startline;
    let end = startline;

    BREAK_OPEN: for (let n = start; n < endline; n++) {
        let lineText = editor.document.lineAt(n);
        for (let c = 0; c < lineText.text.length; c++) {
            switch (lineText.text[c]) {
                case pair[0]:
                    open++;
                    break;
                case pair[1]:
                    open--;
                    if (open === 0) {
                        end = n;
                        break BREAK_OPEN;
                    }
                    break;
            }
        }
    }

    return end;
}

function getKeyValue(fieldType: string): string[] {
    let keyType = ""
    let bracketClose = 5
    let openBrackets = 1
    for(var i=4; i<fieldType.length;i++) {
        let currentChar = fieldType[i]
        if (currentChar === "]") {
            openBrackets--
            if (openBrackets == 0) {
                bracketClose = i+1
                break
            }
        } else if (currentChar === "[") {
            openBrackets++
        } else {
            keyType = keyType + currentChar
        }
    }
    let valueType = fieldType.slice(bracketClose, fieldType.length)

    return [keyType, valueType]
}

export { commandSetterGetter };
import { stringify } from 'querystring';
import * as vscode from 'vscode';
import { StructInfo, Field, GeneratorType, SelectedDecorationType} from './base';
import { GetPatternRange } from './utils';

let typeMap = new Map<string, GeneratorType>();

typeMap.set("Getter", GeneratorType.Getter);
typeMap.set("Wither", GeneratorType.Wither);
 
enum FuncType {
    None = 0,
    Get = 1 << 0,
    With = 1 << 1,
    WithAt = 1 << 2,
    At = 1 << 3,
    Keys = 1 << 4,
    Num = 1 << 5
}

let fieldDataByFunc: Map<string, [string, FuncType]> = new Map();
let strikesPerField: Map<string, FuncType> = new Map();

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
                    fieldDataByFunc = new Map()
                    strikesPerField = new Map()
                    sinfo.Fields.forEach((field: Field, name: string) => {
                        let proper = field.ProperName
                        let singular = field.SingularName
                        if (field.IsArray) {
                            fieldDataByFunc.set(numFunc(proper), [name, FuncType.Num])
                            fieldDataByFunc.set(atFunc(singular), [name, FuncType.At])
                            fieldDataByFunc.set(withAtFunc(singular), [name, FuncType.WithAt])
                            fieldDataByFunc.set(withFunc(singular), [name, FuncType.With])
                            strikesPerField.set(name, FuncType.Num | FuncType.At | FuncType.WithAt | FuncType.With)
                        } else if (field.IsMap) {
                            fieldDataByFunc.set(atFunc(singular), [name, FuncType.At])
                            fieldDataByFunc.set(keysFunc(singular), [name, FuncType.Keys])
                            fieldDataByFunc.set(withFunc(singular), [name, FuncType.With])
                            strikesPerField.set(name, FuncType.At | FuncType.Keys | FuncType.With)
                        } else {
                            fieldDataByFunc.set(getFunc(singular), [name, FuncType.Get])
                            fieldDataByFunc.set(withFunc(singular), [name, FuncType.With])
                            strikesPerField.set(name, FuncType.Get | FuncType.With)
                        }
                    });

                    GeneratorGetWith(sinfo, gtype);
                }
            }

            let editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.setDecorations(SelectedDecorationType, []);
            }
        });
    } else {
        vscode.window.showErrorMessage("There is no struct(go) in focus. Please place cursor in the code of a struct.");
    }
}

function GeneratorGetWith(sinfo: StructInfo, stype: GeneratorType) {

    console.log(sinfo);

    let editor = vscode.window.activeTextEditor;
    if (editor !== undefined) {

        let regexFunction = `^func {0,}\\(.+${sinfo.Name} {0,}\\) {0,} ([a-zA-Z_]+) {0,}\\(`;
        for (let n = 0; n < editor.document.lineCount; n++) {
            let line = editor.document.lineAt(n);
            let matches = line.text.match(regexFunction);
            if (matches !== null) {
                let fieldData = fieldDataByFunc.get(matches[1])
                if (fieldData) {
                    let strikes = strikesPerField.get(fieldData[0])
                    if (strikes) {
                        strikesPerField.set(fieldData[0], strikes&~fieldData[1])
                    }  
                }
            }
        }

        const options = <vscode.QuickPickOptions>{ canPickMany: true, placeHolder: "Select the fields that need functions" };
        var items: vscode.QuickPickItem[] = [];

        var obj = {
            info: sinfo,
            fields2items: function () {
                this.info.Fields.forEach((value, key) => {
                    let strikes = strikesPerField.get(key)
                    if (strikes) {
                        items.push(<vscode.QuickPickItem>{
                            label: value.toString(),
                            detail: this.info.Name,
                            description: key,
                        });
                    } else {
                        vscode.window.showInformationMessage(`All possiible options already exist for ${key}`);
                    }
                });
            },

            pick: function () {
                this.fields2items();
                if (items.length) {
                    vscode.window.showQuickPick(items.reverse(), options).then((item) => {
                        if (item) {
                            let fields = item as any as vscode.QuickPickItem[];
                            let sname = getAbbreviation(this.info.Name) as string;
                            let structString = `func (${sname} ${this.info.Name})`;

                            fields.forEach((qitem) => {
                                let field = this.info.Fields.get(qitem.description as string);

                                if (field) {
                                    let funcFlags = strikesPerField.get(field.Key)
                                    let resolvedFlags = 0b0
                                    if (funcFlags) {
                                        resolvedFlags = funcFlags
                                    }

                                    if (resolvedFlags) {
                                        let editor = vscode.window.activeTextEditor;
                                        if (editor) {
    
                                            let proper = field.ProperName
                                            let keyNameLower = proper[0].toLowerCase() + proper.slice(1);
                                            let singular = field.SingularName
                                            let keyNameSingularLower = singular[0].toLowerCase() + singular.slice(1);
    
                                            // With
                                            if (stype & GeneratorType.Wither) {
                                                if (field.IsArray) {
                                                    let arrType = field.Type.substring(2)
                                                    if (resolvedFlags&FuncType.WithAt){
                                                        let func = withAtFunc(singular)
                                                        let withAtSS = new vscode.SnippetString(
                                                            `\n// ${func} returns a copy with the ${arrType} at the given index of ${keyNameLower}\n${structString} ${func}(i int, item ${arrType}) ${this.info.Name} {\n\t${sname}${field.Parent}${field.Name} = append(${sname}${field.Parent}${field.Name}[:i], append([]${arrType}{item}, ${sname}${field.Parent}${field.Name}[i+1:]...)...)\n\treturn ${sname}\n}\n`
                                                        )
                                                        editor.insertSnippet(withAtSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                                    }

                                                    if (resolvedFlags&FuncType.With){
                                                        let func2 = withFunc(singular) 
                                                        let withSS = new vscode.SnippetString(
                                                            `\n// ${func2} returns a copy with the ${arrType} appended\n${structString} ${func2}(item ${arrType}) ${this.info.Name} {\n\t${sname}${field.Parent}${field.Name} = append(${sname}${field.Parent}${field.Name}, item)\n\treturn ${sname}\n}\n`
                                                        )
                                                        editor.insertSnippet(withSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                                    }    
                                                } else if (field.IsMap){
                                                    if (resolvedFlags&FuncType.With){
                                                        let mapTypes = getKeyValue(field.Type)
                                                        let keyType = mapTypes[0]
                                                        let valueType = mapTypes[1]
                  
                                                        let func = withFunc(singular) 
                                                        let withSS = new vscode.SnippetString(
                                                            `\n// ${func} returns a copy with the ${valueType} with the given key ${keyType}\n${structString} ${func}(key ${keyType}, value ${valueType}) ${this.info.Name} {\n\t${sname}${field.Parent}${field.Name}[key] = value\n\treturn ${sname}\n}\n`
                                                        )
                                                        editor.insertSnippet(withSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                                    }
                                                } else {
                                                    if (resolvedFlags&FuncType.With) {
                                                        let func = withFunc(singular)
                                                        let ss = new vscode.SnippetString(
                                                            `\n// ${func} returns a copy with the given ${field.Type} ${field.Name}\n${structString} ${func}(${field.Name} ${field.Type}) ${this.info.Name}{\n\t${sname}${field.Parent}${field.Name} = ${field.Name}\n\treturn ${sname}\n}\n`);
                                                        editor.insertSnippet(ss, new vscode.Position(this.info.Range[1] + 1, 0));
                                                    }
                                                }
                                            }
    
                                            if (stype & GeneratorType.Getter) {
                                                if (field.IsArray) {
                                                    let arrType = field.Type.substring(2)
    
                                                    if (resolvedFlags&FuncType.Num) {
                                                        let func = numFunc(proper)
                                                        let numSS = new vscode.SnippetString(
                                                            `\n// ${func} returns the number of ${keyNameLower} of type ${arrType}\n${structString} ${func}() int {\n\treturn len(${sname}${field.Parent}${field.Name})\n}\n`
                                                        )
                                                        editor.insertSnippet(numSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                                    }

                                                    if (resolvedFlags&FuncType.At) {
                                                        let func2 = atFunc(singular)
                                                        let atSS = new vscode.SnippetString(
                                                            `\n// ${func2} returns the ${keyNameSingularLower} of type ${arrType} at the requested index\n${structString} ${func2}(i int) ${field.Type.substring(2)} {\n\treturn ${sname}${field.Parent}${field.Name}[i]\n}\n`
                                                        )
                                                        editor.insertSnippet(atSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                                    }
                                                } else if (field.IsMap){
                                                    let mapTypes = getKeyValue(field.Type)
                                                    let keyType = mapTypes[0]
                                                    let valueType = mapTypes[1]
    
                                                    if (resolvedFlags&FuncType.At) {
                                                        let func = atFunc(singular) 
                                                        let atSS = new vscode.SnippetString(
                                                            `\n// ${func} returns the ${keyNameSingularLower} of type ${valueType} at the requested key\n${structString} ${func}(key ${keyType}) ${valueType} {\n\treturn ${sname}${field.Parent}${field.Name}[key]\n}\n`
                                                        )
                                                        editor.insertSnippet(atSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                                    }
             
                                                    if (resolvedFlags&FuncType.Keys) {
                                                        let func2 = keysFunc(singular) 
                                                        let getSS = new vscode.SnippetString(
                                                            `\n// ${func2} returns the ${keyType} keys of ${keyNameSingularLower} of type ${valueType}\n${structString} ${func2}() []${keyType} {\n\tkeys := make([]${keyType}, len(${sname}${field.Parent}${field.Name}))\n\ti := 0\n\tfor k := range ${sname}${field.Parent}${field.Name} {\n\t\tkeys[i] = k \n\t\ti++\n\t} \n\treturn keys\n}\n`
                                                        )
                                                        editor.insertSnippet(getSS, new vscode.Position(this.info.Range[1] + 1, 0))
                                                    }
                                                } else {
                                                    if (resolvedFlags&FuncType.Get) {
                                                        let func = getFunc(singular)
                                                        let ss = new vscode.SnippetString(`\n// ${func} returns the ${field.Type} ${field.Name} \n${structString} ${func}() ${field.Type} {\n\treturn ${sname}${field.Parent}${field.Name}\n}\n`);
                                                        editor.insertSnippet(ss, new vscode.Position(this.info.Range[1] + 1, 0));
                                                    }
                                                }
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

function numFunc(proper: string): string {
    return `Num${proper}`
}

function atFunc(singular: string): string {
    return `${singular}At`
}

function withAtFunc(singular: string): string {
    return `With${singular}At`
}

function withFunc(singular: string): string {
    return `With${singular}`
}

function keysFunc(singular: string): string {
    return `Get${singular}Keys`
}

function getFunc(singular: string): string {
    return `Get${singular}`
}

export { commandSetterGetter };
import { type AstNode, type LangiumDocument } from 'langium';
import { DefaultDocumentSymbolProvider } from 'langium/lsp';
import { SymbolKind, type DocumentSymbol } from 'vscode-languageserver';
import * as ast from './generated/ast.js';

export class WhiteLanguageDocumentSymbolProvider extends DefaultDocumentSymbolProvider {
    
    protected override getSymbol(document: LangiumDocument, astNode: AstNode): DocumentSymbol[] {
        const symbols = super.getSymbol(document, astNode);
        if (symbols.length > 0) {
            const symbol = symbols[0];
            if (ast.isStructDecl(astNode)) {
                symbol.kind = SymbolKind.Struct;
            } else if (ast.isFunctionDecl(astNode)) {
                symbol.kind = SymbolKind.Function;
            } else if (ast.isExternFuncDecl(astNode)) {
                symbol.kind = SymbolKind.Interface; 
            } else if (ast.isVariableDecl(astNode)) {
                symbol.kind = astNode.kind === 'const' ? SymbolKind.Constant : SymbolKind.Variable;
            } else if (ast.isForVarDecl(astNode)) {
                symbol.kind = SymbolKind.Variable;
            }
        }
        
        return symbols;
    }
}
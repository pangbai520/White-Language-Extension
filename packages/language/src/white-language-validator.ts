import { AstUtils, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { DiagnosticTag } from 'vscode-languageserver-protocol';
import * as ast from './generated/ast.js';
import type { WhiteLanguageServices } from './white-language-module.js';

export class WhiteLanguageValidator {
    checkAssignment(node: ast.Assignment | ast.VariableDecl | ast.ForVarDecl, accept: ValidationAcceptor): void {
        let leftType: string | undefined;
        let rightExpr: ast.Expression | undefined;

        if (ast.isVariableDecl(node) || ast.isForVarDecl(node)) {
            if (!node.value) return; 
            leftType = this.getTypeString(node.type, node.isPtr, node.ptrLevel);
            rightExpr = node.value;
        } else {
            leftType = this.inferExpressionType(node.left);
            rightExpr = node.right;
        }

        if (leftType && rightExpr) {
            const rightType = this.inferExpressionType(rightExpr);

            if (!this.isTypeCompatible(leftType, rightType)) {
                accept('error', `Type mismatch: cannot assign '${rightType}' to '${leftType}'.`, { 
                    node, 
                    property: (ast.isVariableDecl(node) || ast.isForVarDecl(node)) ? 'value' : 'right' 
                });
            }
        }
    }

    checkReturnStatement(ret: ast.ReturnStmt, accept: ValidationAcceptor): void {
        const func = AstUtils.getContainerOfType(ret, ast.isFunctionDecl);
        if (!func) return;

        const expectedType = this.getTypeString(func.returnType);
        const actualType = ret.value ? this.inferExpressionType(ret.value) : 'Void';

        if (!this.isTypeCompatible(expectedType, actualType)) {
            accept('error', `Type mismatch: function '${func.name}' expects '${expectedType}' return, but got '${actualType}'.`, {
                node: ret,
                property: 'value'
            });
        }
    }

    checkDivisionByZero(expr: ast.BinaryExpression, accept: ValidationAcceptor): void {
        if (expr.op === '/' || expr.op === '%') {
            if (ast.isLiteral(expr.right)) {
                const val = expr.right.value;
                if (val === 0 || val === 0.0 || val === '0' || val === '0.0') {
                    accept('error', 'ZeroDivisionError: Division by zero is not allowed.', { 
                        node: expr, 
                        property: 'right' 
                    });
                }
            }
        }
    }

    checkUnreachableCode(block: ast.Block, accept: ValidationAcceptor): void {
        let unreachable = false;
        for (const stmt of block.statements) {
            if (unreachable) {
                accept('warning', 'Unreachable code.', {
                    node: stmt,
                    tags: [DiagnosticTag.Unnecessary]
                });
            } else if (ast.isReturnStmt(stmt) || ast.isBreakStmt(stmt) || ast.isContinueStmt(stmt)) {
                unreachable = true;
            }
        }
    }

private isTypeCompatible(expected: string, actual: string): boolean {
        if (expected === 'Any' || actual === 'Any' || expected === actual) {
            return true;
        }

        if (expected === 'Struct' || actual === 'Struct' || expected === 'Function' || actual === 'Function') {
            return true;
        }

        if (actual === 'Pointer') {
            return true;
        }

        if (actual === 'Int' && expected === 'Long') return true;
        if (actual === 'Byte' && (expected === 'Int' || expected === 'Long')) return true;

        return false;
    }

    private inferExpressionType(expr: ast.Expression): string {
        if (ast.isLiteral(expr)) {
            const text = expr.$cstNode?.text || "";
            if (text.startsWith('"')) return 'String';
            if (text === 'true' || text === 'false') return 'Bool';
            if (text.includes('.')) return 'Float';
            if (text === 'null' || text === 'nullptr') return 'Pointer';
            return 'Int';
        }
        
        if (ast.isReference(expr)) {
            const decl = expr.ref?.ref;
            if (decl) {
                if (ast.isVariableDecl(decl) || ast.isParam(decl) || ast.isForVarDecl(decl)) {
                    return this.getTypeString(decl.type, decl.isPtr, decl.ptrLevel);
                }
            }
        }

        if (ast.isFunctionCall(expr)) {
            const caller = expr.caller;
            if (ast.isReference(caller)) {
                const func = caller.ref?.ref;
                if (ast.isFunctionDecl(func) || ast.isExternFuncDecl(func)) {
                    return this.getTypeString(func.returnType);
                }
            }
        }

        if (ast.isBinaryExpression(expr)) {
            const logicOps = ['==', '!=', '<', '>', '<=', '>=', 'is', 'in', '&&', '||'];
            if (logicOps.includes(expr.op)) {
                return 'Bool';
            }
            return this.inferExpressionType(expr.left);
        }

        if (ast.isUnaryExpression(expr)) {
            const innerType = this.inferExpressionType(expr.value);
            if (expr.op === 'ref') {
                return `ptr<${innerType}>`;
            }
            if (expr.op === '!') return 'Bool';
            return innerType;
        }

        if (ast.isDerefExpression(expr)) {
            const innerType = this.inferExpressionType(expr.value);
            const match = innerType.match(/^ptr<(.+)>$/);
            if (match) return match[1];
            return 'Any';
        }

        return 'Any';
    }

    private getTypeString(type: ast.TypeReference | undefined, isPtr: boolean = false, ptrLevel: number | undefined = undefined): string {
        if (!type) return isPtr ? 'ptr<Void>' : 'Void';
        let typeName = "Any";

        if (ast.isPrimitiveType(type)) {
            typeName = type.name ?? 'Any'; 
        } 
        else if (ast.isNamedType(type)) {
            typeName = type.ref?.ref?.name ?? 'Unknown';
        } 
        else if (ast.isPointerType(type)) {
            typeName = `ptr<${this.getTypeString(type.elementType)}>`;
        } 
        else if (ast.isVectorType(type)) {
            typeName = 'Vector';
        }

        if (isPtr) {
            let level = ptrLevel ?? 1;
            let result = typeName;
            for (let i = 0; i < level; i++) {
                result = `ptr<${result}>`;
            }
            return result;
        }

        return typeName;
    }

    checkFunctionParams(func: ast.FunctionDecl | ast.ExternFuncDecl, accept: ValidationAcceptor): void {
        const seen = new Set<string>();
        for (const param of func.params) {
            if (param.name) {
                if (seen.has(param.name)) {
                    accept('error', `Parameter '${param.name}' is already defined.`, { node: param, property: 'name' });
                }
                seen.add(param.name);
            }
        }
    }

    checkNamedTypeIsStruct(typeNode: ast.NamedType, accept: ValidationAcceptor): void {
        if (typeNode.ref && typeNode.ref.ref) {
            const target = typeNode.ref.ref;
            if (!ast.isStructDecl(target)) {
                let targetName = 'Unknown';
                if ('name' in target && typeof target.name === 'string') {
                    targetName = target.name;
                }
                accept('error', `Symbol '${targetName}' is not a type. Only Structs can be used as named types.`, {
                    node: typeNode,
                    property: 'ref'
                });
            }
        }
    }

    checkStructName(struct: ast.StructDecl, accept: ValidationAcceptor): void {
        const builtInTypes = ['Int', 'Float', 'String', 'Bool', 'Void', 'Byte', 'Long', 'Struct', 'Vector', 'Function'];
        if (struct.name && builtInTypes.includes(struct.name)) {
            accept('error', `Type name '${struct.name}' is reserved and cannot be used as a struct name.`, { node: struct, property: 'name' });
        }
    }
}


export function registerValidationChecks(services: WhiteLanguageServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.WhiteLanguageValidator;
    
    const checks: ValidationChecks<ast.WhiteLanguageAstType> = {
        VariableDecl: [validator.checkAssignment],
        ForVarDecl: [validator.checkAssignment],
        Assignment: validator.checkAssignment,
        ReturnStmt: validator.checkReturnStatement,
        BinaryExpression: validator.checkDivisionByZero,
        StructDecl: validator.checkStructName,
        NamedType: validator.checkNamedTypeIsStruct,
        FunctionDecl: validator.checkFunctionParams,
        ExternFuncDecl: validator.checkFunctionParams,
        Block: validator.checkUnreachableCode
    };
    
    registry.register(checks, validator);
}
grammar WhiteLanguage

entry Program:
    statements+=Statement*;

// ==========================================
// Statements
// ==========================================
Statement:
    Import |
    DeclarationStmt | ControlStmt |
    SpecialStmt | ExpressionStmt | Block | EmptyStmt;

DeclarationStmt:
    (VariableDecl | ExternSingleStmt) ';' |
    (FunctionDecl | StructDecl | ClassDecl | ExternBlock);

ControlStmt:
    IfStmt | WhileStmt | ForStmt;

SpecialStmt:
    (ReturnStmt | BreakStmt | ContinueStmt) ';';

ExpressionStmt:
    Expression ';';

EmptyStmt:
    {infer EmptyStmt} ';';

Block:
    leftBrace='{' statements+=Statement* rightBrace='}';

// ==========================================
// Declarations
// ==========================================
type Declaration = VariableDecl | FunctionDecl | StructDecl | ClassDecl | ClassField | ClassMethod | ClassInit | ClassDeinit | ExternFuncDecl | ForVarDecl | Param | SymbolImport |
    FileImport;

VariableDecl:
    {infer VariableDecl} kind=('let' | 'const') (isPtr?='ptr' ('*' ptrLevel=INT)?)? name=ValidID '->' type=TypeReference ('=' value=Expression)?;

ForVarDecl:
    {infer ForVarDecl} (isPtr?='ptr' ('*' ptrLevel=INT)?)? name=ValidID '->' type=TypeReference ('=' value=Expression)?;

FunctionDecl:
    {infer FunctionDecl} 'func' name=ValidID '(' (params+=Param (',' params+=Param)*)? (','? varArgs?='...')? ')' ('->' returnType=TypeReference) body=Block;

Param:
    {infer Param} (isPtr?='ptr' ('*' ptrLevel=INT)?)? name=ValidID '->' type=TypeReference;

StructDecl:
    {infer StructDecl} 'struct' name=ValidID '(' (fields+=Param (',' fields+=Param)*)? ')' (body=Block)? ';'? ;

ClassDecl:
    {infer ClassDecl} 'class' name=ValidID ('(' superClass=[Declaration:ValidID] ')')? leftBrace='{'
        (members+=ClassMember)*
    rightBrace='}';

ClassMember:
    ClassField | ClassMethod | ClassInit | ClassDeinit;

ClassField:
    {infer ClassField} kind=('let' | 'const') (isPtr?='ptr' ('*' ptrLevel=INT)?)? name=ValidID '->' type=TypeReference ('=' value=Expression)? ';';

ClassInit:
    {infer ClassInit} name='init' '(' (params+=Param (',' params+=Param)*)? ')' ('->' returnType=TypeReference)? body=Block;

ClassDeinit:
    {infer ClassDeinit} name='deinit' '(' ')' ('->' returnType=TypeReference)? body=Block;

ClassMethod:
    {infer ClassMethod} 'method' name=ValidID '(' (params+=Param (',' params+=Param)*)? (','? varArgs?='...')? ')' ('->' returnType=TypeReference) body=Block;

ExternBlock:
    {infer ExternBlock} 'extern' abi=STRING leftBrace='{' (funcs+=ExternFuncDecl ';')* rightBrace='}';

ExternSingleStmt:
    {infer ExternSingleStmt} 'extern' func=ExternFuncDecl ('from' abi=STRING)?;

ExternFuncDecl:
    {infer ExternFuncDecl} 'func' name=ValidID '(' (params+=Param (',' params+=Param)*)? (','? varArgs?='...')? ')' ('->' returnType=TypeReference)?;

// ==========================================
// Imports
// ==========================================
Import:
    'import' (
        (fileImports+=FileImport (',' fileImports+=FileImport)*) 
        | 
        (symbolImports+=SymbolImport (',' symbolImports+=SymbolImport)* 'from' fromPath=STRING)
    ) ';'?;

FileImport:
    path=STRING ('as' name=ValidID)?;

SymbolImport:
    importedElement=[Declaration:ValidID] ('as' name=ValidID)?;

// ==========================================
// Control Flow
// ==========================================
IfStmt: {infer IfStmt} 'if' condition=Expression thenBlock=Block ('else' (elseIf=IfStmt | elseBlock=Block))? ';'? ;
WhileStmt: {infer WhileStmt} 'while' condition=Expression body=Block ';'? ;
ForStmt: {infer ForStmt} 'for' '(' (init=(VariableDecl | ForVarDecl | Expression))? ';' condition=Expression ';' (step=Expression)? ')' body=Block ';'? ;

ReturnStmt: {infer ReturnStmt} 'return' (value=Expression)?;
BreakStmt: {infer BreakStmt} 'break';
ContinueStmt: {infer ContinueStmt} 'continue';

// ==========================================
// Type References
// ==========================================
TypeReference: PointerType | VectorType | FunctionType | PrimitiveType | NamedType;
PointerType: {infer PointerType} 'ptr' ('*' level=INT)? elementType=TypeReference;
VectorType: {infer VectorType} 'Vector' ('(' elementType=TypeReference ')')?;
FunctionType: {infer FunctionType} 'Function' ('(' returnType=TypeReference ')')?;
PrimitiveType: {infer PrimitiveType} name=('Int' | 'Float' | 'String' | 'Bool' | 'Void' | 'Byte' | 'Long' | 'Struct');
NamedType: {infer NamedType} ref=[Declaration:ValidID];

// ==========================================
// Expressions
// ==========================================
Expression: Assignment;

Assignment infers Expression: 
    LogicalOr ({infer Assignment.left=current} op=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '**=') right=Assignment)?;

LogicalOr infers Expression: 
    LogicalAnd ({infer BinaryExpression.left=current} op='||' right=LogicalAnd)*;

LogicalAnd infers Expression: 
    Equality ({infer BinaryExpression.left=current} op='&&' right=Equality)*;

Equality infers Expression: 
    Relational ({infer BinaryExpression.left=current} (op='==' | op='!=' | (op='is' isNot?='!'?) | op='in') right=Relational)*;

Relational infers Expression: 
    Additive ({infer BinaryExpression.left=current} op=('<' | '>' | '<=' | '>=') right=Additive)*;

Additive infers Expression: 
    Multiplicative ({infer BinaryExpression.left=current} op=('+' | '-') right=Multiplicative)*;

Multiplicative infers Expression: 
    Power ({infer BinaryExpression.left=current} op=('*' | '/' | '%') right=Power)*;

Power infers Expression: 
    Unary ({infer BinaryExpression.left=current} op='**' right=Unary)*;

Unary infers Expression:
    {infer UnaryExpression} op=('!' | '-' | '+' | 'ref') value=Unary |
    {infer DerefExpression} 'deref' ('*' level=INT)? value=Unary |
    Postfix;

Postfix infers Expression:
    Primary (
        {infer MemberAccess.receiver=current} '.' member=ValidID |
        {infer ArrayAccess.receiver=current} '[' index=Expression ']' |
        {infer FunctionCall.caller=current} '(' (args+=Argument (',' args+=Argument)*)? ')' |
        {infer PostfixUpdate.operand=current} op=('++' | '--')
    )*;

ValidID returns string:
    ID | 'init' | 'deinit' | 'this' | 'self' | 'super';

Primary infers Expression:
    '(' Expression ')' |
    {infer Literal} value=(INT | FLOAT | STRING | BOOLEAN | 'null' | 'nullptr') |
    'this' {infer ThisExpression} |
    'self' {infer SelfExpression} |
    'super' {infer SuperExpression} |
    {infer VectorLiteral} '[' (elements+=Expression (',' elements+=Expression)*)? ']' |
    {infer Reference} ref=[Declaration:ValidID];

Argument: (name=ValidID '=')? value=Expression;

// ==========================================
// Terminals
// ==========================================
BOOLEAN returns boolean: 'true' | 'false';
terminal FLOAT returns number: /[0-9]*\.[0-9]+/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"/;
terminal ID: /[_a-zA-Z][_a-zA-Z0-9]*/;

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
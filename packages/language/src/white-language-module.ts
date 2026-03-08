import type { Module } from 'langium';
import { inject } from 'langium';
import { 
    createDefaultModule, 
    createDefaultSharedModule, 
    type DefaultSharedModuleContext, 
    type LangiumServices, 
    type LangiumSharedServices, 
    type PartialLangiumServices 
} from 'langium/lsp';
import { WhiteLanguageGeneratedModule, WhiteLanguageGeneratedSharedModule } from './generated/module.js';
import { WhiteLanguageValidator, registerValidationChecks } from './white-language-validator.js';
import { WhiteLanguageScopeProvider, WhiteLanguageScopeComputation } from './white-language-scope-provider.js';
import { WhiteLanguageSemanticTokenProvider } from './white-language-semantic-tokens.js';
import { WhiteLanguageHoverProvider } from './white-language-hover-provider.js';
import { WhiteLanguageCompletionProvider } from './white-language-completion-provider.js';
import { WhiteLanguageSignatureHelpProvider } from './white-language-signature-provider.js';
import { WhiteLanguageDocumentSymbolProvider } from './white-language-document-symbol-provider.js';


export type WhiteLanguageAddedServices = {
    validation: {
        WhiteLanguageValidator: WhiteLanguageValidator
    },
    lsp: {
        SemanticTokenProvider: WhiteLanguageSemanticTokenProvider,
        HoverProvider: WhiteLanguageHoverProvider,
        CompletionProvider: WhiteLanguageCompletionProvider
    }
}

export type WhiteLanguageServices = LangiumServices & WhiteLanguageAddedServices

export const WhiteLanguageModule: Module<WhiteLanguageServices, PartialLangiumServices & WhiteLanguageAddedServices> = {
    validation: {
        WhiteLanguageValidator: () => new WhiteLanguageValidator()
    },
    references: {
        ScopeProvider: (services: WhiteLanguageServices) => new WhiteLanguageScopeProvider(services),
        ScopeComputation: (services: WhiteLanguageServices) => new WhiteLanguageScopeComputation(services)
    },
    lsp: {
        SemanticTokenProvider: (services: WhiteLanguageServices) => new WhiteLanguageSemanticTokenProvider(services),
        HoverProvider: (services: WhiteLanguageServices) => new WhiteLanguageHoverProvider(services),
        CompletionProvider: (services: WhiteLanguageServices) => new WhiteLanguageCompletionProvider(services),
        SignatureHelp: () => new WhiteLanguageSignatureHelpProvider(),
        DocumentSymbolProvider: (services: WhiteLanguageServices) => new WhiteLanguageDocumentSymbolProvider(services)
    }
};

export function createWhiteLanguageServices(context: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    WhiteLanguage: WhiteLanguageServices
} {
    const shared = inject(
        createDefaultSharedModule(context),
        WhiteLanguageGeneratedSharedModule
    );
    const WhiteLanguage = inject(
        createDefaultModule({ shared }),
        WhiteLanguageGeneratedModule,
        WhiteLanguageModule
    );
    shared.ServiceRegistry.register(WhiteLanguage);
    registerValidationChecks(WhiteLanguage);
    return { shared, WhiteLanguage };
}
import preferAlias from "@dword-design/eslint-plugin-import-alias";
import pluginJs from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import lodashPlugin from "eslint-plugin-lodash";
import prettierPlugin from "eslint-plugin-prettier";
import reactPlugin from "eslint-plugin-react";
import pluginReact from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

// import tseslint from "typescript-eslint";

export default [
	{
		ignores: [
			"node_modules",
			"build",
			"dist",
			"**/*.next/**/*",
			"**/node_modules/**/*",
			"**/dist/**/*",
			"public/sw.js",
			"public/workbox-*",
			"public/service-worker.js",
			// «دُور»: the design's own game module, kept exactly as delivered (src/bd/dowr/vendor/README.md).
			"src/bd/dowr/vendor/**",
			// «جاسوس»: the design's own game module, kept exactly as delivered (src/bd/spy/vendor/README.md).
			"src/bd/spy/vendor/**",
		],
	},
	{
		files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
				project: "./tsconfig.json",
			},
			globals: {
				browser: "readonly",
				node: "readonly",
				commonjs: "readonly",
				es6: "readonly",
				jest: "readonly",
				mocha: "readonly",
			},
		},
		plugins: {
			"@typescript-eslint": tsPlugin,
			react: reactPlugin,
			"react-hooks": reactHooksPlugin,
			"jsx-a11y": jsxA11yPlugin,
			lodash: lodashPlugin,
			prettier: prettierPlugin,
			"@next/next": nextPlugin,
		},
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-unused-vars": "error",
			"@typescript-eslint/no-empty-function": "error",
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
			"no-console": "warn",
			"no-debugger": "error",
			"no-empty": "error",
			"prefer-const": "error",
			"jsx-a11y/accessible-emoji": "off",
			"react/react-in-jsx-scope": "off",
		},
		settings: {
			react: {
				version: "detect",
			},
		},
	},
	{
		files: ["*.ts", "*.tsx"],
		rules: {
			"@typescript-eslint/no-extra-semi": "off",
			"no-eq-null": "error",
			"prefer-spread": "error",
			"no-const-assign": "error",
			eqeqeq: "error",
			"no-duplicate-imports": "error",
			strict: "error",
			"no-invalid-regexp": "error",
			"valid-typeof": "error",
			"no-empty-function": "error",
		},
	},
	{
		files: ["*.js", "*.jsx"],
		rules: {
			strict: "error",
		},
	},
	{
		files: ["*.spec.ts", "*.spec.tsx", "*.spec.js", "*.spec.jsx"],
		rules: {
			"no-console": "off",
		},
	},
	{
		files: ["next.config.js"],
		rules: {
			"no-console": "off",
		},
	},
	{
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "@mui",
							message: "Importing from @mui is not allowed in this project.",
						},
					],
					patterns: [{ regex: "^@mui/[^/]+$" }],
				},
			],
		},
	},
	{
		files: [
			"src/libs/{components/atoms,styles,uiHooks,http,components/icons}/**/*",
		],
		rules: {
			"no-restricted-imports": "off",
		},
	},
	{ languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	pluginJs.configs.recommended,
	// ...tseslint.configs.recommended,
	pluginReact.configs.flat.recommended,
	{
		plugins: {
			"@dword-design/import-alias": preferAlias,
		},
		rules: {
			"@dword-design/import-alias/prefer-alias": [
				"error",
				{
					alias: {
						"@/public": "./public",
						"@": "./src",
					},
				},
			],
		},
	},
	{
		plugins: {
			"unused-imports": unusedImports,
		},
	},
	{
		settings: {
			react: {
				version: "detect",
			},
		},
		rules: {
			// Consistently import navigation APIs from `@/navigation` for multi lingual only
			// "no-restricted-imports": [
			// 	"error",
			// 	{
			// 		name: "next/link",
			// 		message: "Please import from `@/i18n` instead.",
			// 	},
			// 	{
			// 		name: "next/navigation",
			// 		importNames: [
			// 			"redirect",
			// 			"permanentRedirect",
			// 			"useRouter",
			// 			"usePathname",
			// 		],
			// 		message: "Please import from `@/i18n` instead.",
			// 	},
			// ],
			"no-undef": "off",
			"react/jsx-curly-brace-presence": ["error", "never"],
			"react/react-in-jsx-scope": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"react/prop-types": "off",
			"no-unused-vars": "off", // or "@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/no-unused-expression": "off",
			"unused-imports/no-unused-imports": "error",
			"@typescript-eslint/no-require-imports": "off",
			"react/no-children-prop": "off",
			"no-console": ["warn", { allow: ["warn"] }],
			"unused-imports/no-unused-vars": [
				"warn",
				{
					vars: "all",
					varsIgnorePattern: "^_",
					args: "after-used",
					argsIgnorePattern: "^_",
				},
			],
		},
	},
];

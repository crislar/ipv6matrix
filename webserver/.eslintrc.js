module.exports = {
	"ignorePatterns": ["static/**"],
	"env": {
		"commonjs": true,
		"es2021": true,
		"node": true
	},
	"extends": "eslint:recommended",
	"parserOptions": {
		"ecmaVersion": 12
	},
	"rules": {
		"indent": ["warn", "tab", {
			"SwitchCase": 1
		}],
		"semi": ["warn", "always"]
	}
};

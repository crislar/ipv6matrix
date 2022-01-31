({
	appDir: '../dev',
	dir: '../deploy',
	baseUrl: 'js/visual',

	optimizeCss: 'standard',
	removeCombined: true,
	preserveLicenseComments: false,

	mainConfigFile: '../dev/js/visual-app.js',

	modules: [
		{
			name: '../visual-app'
		}
	]
})
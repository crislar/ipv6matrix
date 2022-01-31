define(function (require) {
	var Backbone = require('backbone');
    var $ = require('jquery');
    var _ = require('underscore');
	var Utils = require('utils');

	var SliderView = require('views/controller/sliderView');
	var SettingsView = require('views/controller/settingsView');

	var ControllerView = Backbone.View.extend({
		template: $("#template-controller").html(),
		templateGroup: _.template($("#template-controller-group").html()),

		events: {
			"mouseover td.groups": "hoverGroups",
			"mouseout td.groups": "hoverGroups",
			"click #groups-list li": "clickGroup",
			"click #settings-button": "clickSettings",
			'resize #controller': "resize"
		},

		initialize: function(_options){
			this.controllerModel = _options.controllerModel;

			this.$el.html(this.template);

			this.$controller = $("#controller", this.$el);
			this.$content = $("#content");
			this.$contentOuter = $("#content-outer");

			this.$sliderTd = $("td.slider", this.$el);
			this.$settingsTd = $("td.settings", this.$el);
			this.$settingsButton = $("#settings-button", this.$el);
			this.$settings = $("div.settings", this.$el);
			this.$groupsTd = $("td.groups", this.$el);
			this.$groupsButton = $("#groups-button", this.$el);
			this.$groupsList = $("#groups-list", this.$el);

			this.sliderView = new SliderView({model: this.model, controllerModel: this.controllerModel});

			this.settingsRender = false;
		},

		render: function() {
			this.delegateEvents();

			this.setViews();
			this.setGroups();
			this.setCurrentGroup();
			this.resize();

			this.$sliderTd.append(this.sliderView.$el);
			this.sliderView.render();

			$(window).bind("resize", _.bind(_.debounce(this.resize, Utils.RESIZE_DELAY), this));
			this.listenTo(this.controllerModel, "change", this.setViews);
			this.listenTo(this.model.detailModel, "change:groups", this.setGroups);
			this.listenTo(this.model.detailModel, "change:group", this.setCurrentGroup);

			return this;
		},

		remove: function() {
			this.undelegateEvents();

			this.$sliderTd.empty();

			this.sliderView.remove();

			$(window).unbind("resize");

			Backbone.View.prototype.remove.call(this);
		},

		hoverGroups: function(_event) {
			var over = (_event.type === "mouseover");

			this.$groupsButton.toggleClass("active", over);
			if(over){
				this.$groupsList.stop().fadeIn(100);
			}else{
				this.$groupsList.stop().fadeOut(100);
			}
		},

		clickGroup: function(_event){
			var type = $(_event.currentTarget).attr("data-type");

			if(type){
				this.model.detailModel.set('group', $(_event.currentTarget).attr("data-type"));
			}
		},

		setCurrentGroup: function() {
			$(".current", this.$groupsButton).text("Group by " + Utils.formatGroupTitle(this.model.detailModel.get('group')));
		},

		setGroups: function() {
			this.$groupsList.empty();

			var groups = this.model.detailModel.get('groups');

			if(groups && groups.length){
				for(var i = 0 ; i < groups.length; i++){
					var group = groups[i];
					this.$groupsList.append(this.templateGroup({group: group, label: "Group by " + Utils.formatGroupTitle(group), desc: Utils.descGroup(group)}));
				}
			}
            this.sliderView.resize();
		},

		clickSettings: function() {
			this.$settingsButton.toggleClass('active');
			var active = this.$settingsButton.hasClass('active');

			if(active && !this.settingsRender){
				this.settingsRender = true;
				this.settingsView = new SettingsView({model: this.model});
				this.$settings.append(this.settingsView.$el);
				this.settingsView.render(100);
			}

			var _this = this;

			if(!active){
				this.$settings.slideUp(100, function() { _this.$el.trigger('resize'); });
			}else{
				this.$settings.slideDown(100, function() { _this.$el.trigger('resize'); });
			}
		},

		setViews: function() {
			this.$settingsTd.toggle(this.controllerModel.get('settings'));
			this.$groupsTd.toggle(this.controllerModel.get('groups'));

			if(!this.controllerModel.get('settings')){
				this.settingsRender = false;
				this.$settings.empty();
				this.$settingsButton.removeClass('active');
			}

			this.sliderView.resize();
		},

		resize: function() {
			this.$controller.css({'right': 20+this.$contentOuter.width()-this.$content.width() + 'px'});
			this.$content.css({'padding-bottom': this.$controller.height() + 'px'});

			this.sliderView.resize();
		}
	});

	return ControllerView;
});
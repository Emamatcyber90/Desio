
/**
 * JS for viewing a single file.
 */

;(function($){

/**
 * TabView deals with the version tabs
 * ImageViewer is the sort of image controller. Creates ImageViews. Deals with this on version change.
 * PinView - deals with single pin view
 * ImageView - Viewing a single image extract. Multi page docs get multiple of these. Takes care of showing the pins.
 * CommentsView - the comments section on the sidebar. Handles binding on to the comment collection.
 *
 */

Q.TabView = Q.View.extend({
    
    template: '#tab-template',
    className: 'tab',
    
    init: function(){
        //gets selectedVersion model in the settings.
        _.bindAll(this, 'clickTab', 'changeVersion', 'changeOpenComments');
        this._super.apply(this, arguments);
        this.container.click(this.clickTab);
        
        this.settings.selectedVersion.bind('change:version', this.changeVersion);
    },
    
    render: function(){
        var att = this.model.attributes;
        var data = {
            version: att.version,
            number_comments_open: att.number_comments_open,
            number_comments: att.number_comments,
            comments_class: att.number_comments_open ? 'has-open' : ''
        };
        return this.renderTemplate(data);
    },
    
    changeOpenComments: function(m){
        $.log('open comment change', m);
        var numopen = m.get('number_comments_open');
        
        var com = this.$('.number-comments');
        com.text(numopen);
        
        var fn = 'removeClass';
        if(numopen) fn = 'addClass';
        
        com[fn]('has-open');
        this.$('.tab-text')[fn]('has-open');
    },
    
    changeVersion: function(m){
        if(!m.get().get) return;
        
        if(m.get().get('version') == this.model.get('version')){
            this.container.addClass('selected');
            m.get().bind('change:number_comments_open', this.changeOpenComments);
        }
        else
            this.container.removeClass('selected');
    },
    
    clickTab: function(){
        $.log('setting', this.model.attributes);
        this.settings.selectedVersion.set(this.model);
    }
});

Q.ImageViewer = Q.View.extend('ImageViewer', {
    template: '#image-template',
    className: 'image',
    
    n: {
        title: '.top-bar .text',
        images: '.image-container'
    },
    
    init: function(){
        //gets selectedVersion model in the settings.
        //gets selectedComment in settings
        //gets comments
        //gets pinsMode
        _.bindAll(this, 'changeVersion', 'docClick');
        this._super.apply(this, arguments);
        
        //this will store all the image views. Lazy loaded.
        window.imageViews = this.views = {};
        this.currentVersion = null;
        
        this.settings.selectedVersion.bind('change:version', this.changeVersion)
        
        $(document).mousedown(this.docClick);
    },
    
    docClick: function(e){
        $.log('document click', this.currentVersion, this.views);
        
        var targ = $(e.target);
        var docclick = !(targ.is('.not-doc') || targ.parents('.not-doc').length);
        
        if(docclick && this.currentVersion && this.currentVersion in this.views){
            var v = this.views[this.currentVersion];
            for(var i = 0; i < v.length; i++)
                v[i].release(e);
        }
    },
    
    changeVersion: function(m){
        if(!m.get().get) return;
        
        var ver = m.get().get('version');
        if(ver == this.currentVersion) return;
        
        var model = null;
        for(var i = 0; i < this.model.models.length; i++)
            if(this.model.models[i].get('version') == ver)
                model = this.model.models[i];
        
        if(!model) return;
        
        this.n.images.children().remove();
        
        var images = [];
        if(ver in this.views)
            images = this.views[ver];
        else{
            var extr = model.get('extracts');
            
            for(var i = 0; i < extr.length; i++)
                if(extr[i].extract_type != "thumbnail")
                    images.push(new Q.ImageView(
                        $.extend({}, this.settings, { model: new Backbone.Model(extr[i]) })
                    ));
            
            //if we didnt find any proper extracts, use the real file url
            if(images.length == 0){
                images.push(new Q.ImageView(
                    $.extend({}, this.settings, {
                        model: new Backbone.Model(model.attributes)
                    })
                ));
            }
            
            this.views[ver] = images;
        }
        
        for(var i = 0; i < images.length; i++){
            this.n.images.append(images[i].render().container);
        }
        
        this.currentVersion = ver;
    }
});

Q.PinView = Q.View.extend({
    template: '#pin-template',
    pinsize:{ x: 33, y: 44 },
    className: 'pin',
    
    events: {
        'click': 'setComment'
    },
    
    init: function(){
        //gets:
        // model: is a comment
        // selectedComment
        
        _.bindAll(this, 'updateComment', 'selectComment', 'onChangeCompletionStatus');
        this._super.apply(this, arguments);
        
        this.model.bind('change:completion_status', this.onChangeCompletionStatus);
        this.model.bind('change:body', this.updateComment);
        this.model.pin = this;
        //this.settings.selectedComment.bind('change:comment', this.selectComment);
    },
    
    selectComment: function(m){
        m = m.get();
        if(m && m.id == this.model.id)
            this.container.hide();
        else
            this.container.show();
    },
    
    setComment: function(){
        this.settings.selectedComment.set(this.model);
    },
    
    setScale: function(xscale, yscale){
        this.settings.xscale = xscale;
        this.settings.yscale = yscale;
        position();
    },
    
    position: function(){
        var m = this.model;
        var position = m.get('position');
        
        //find the center of the selection
        var pos = {
            left: (position[0] + position[2]/2 - this.pinsize.x/2)/this.settings.xscale,
            top: (position[1] + position[3]/2 - this.pinsize.y - 10)/this.settings.yscale
        };
        
        this.pin.css(pos);
    },
    
    render: function(){
        var m = this.model;
        
        var pin = this.pin = this.container.append($(_.template(this.template, {
            title: m.get('creator').name + ': ' + m.get('body'),
            completion_status: m.get('completion_status').status
        })));
        
        this.position();
        
        if(m.get('extract'))
            pin.attr('extract', m.get('extract').id);
        
        return this;
    },
    
    onChangeCompletionStatus: function(m){
        var cv = m.get('completion_status');
        var pin = this.$('.pin');
        pin.removeClass('status-'+this.model.statusToggle[cv.status]);
        pin.addClass('status-'+cv.status);
    }
});

Q.ImageView = Q.View.extend({
    template: '#image-template',
    pinTemplate: '#pin-template',
    className: 'image',
    
    init: function(){
        //model is a generic backbone model with a file extract in it
        _.bindAll(this, 'onChange', 'onSelect', 'changeCollapse',
                  'onRelease', 'setCropper', 'onStart', 'changeComment',
                  'onAddComment', 'changePinsMode', 'onChangeVersion', 'onCommentRefresh');
        this._super.apply(this, arguments);
        
        this.pinTemplate = $(this.pinTemplate).html();
        
        this.settings.selectedComment.bind('change:version', this.changeVersion);
        this.settings.selectedComment.bind('change:comment', this.changeComment);
        this.settings.comments.bind('add', this.onAddComment);
        this.settings.comments.bind('refresh', this.onCommentRefresh);
        this.settings.comments.bind('newcomment', this.onAddComment);
        this.settings.pinsMode.bind('change:pins', this.changePinsMode);
        this.settings.collapsable.bind('change:collapse', this.changeCollapse);
        
        this.pinViews = [];
        this.waitForRefresh = false;
    },
    
    onChange: function(c){
        if(this.newCommentView)
            this.newCommentView.hide();
    },
    changeComment: function(m){
        
        m = m.get();
        
        iscollapsed = this.settings.collapsable.isCollapsed();
        if(m && this.container.is(':visible') && (!m.get('extract') || this.model.get('order_index') == m.get('extract').order_index) && m.hasPosition()){
            this.hidePopups();
            var pos = m.get('position');
            this.pins.hide();
            this.cropper.setSelect([pos[0], pos[1], pos[2]+pos[0], pos[3]+pos[1]]);
            
            if(iscollapsed)
                this.popupCommentView.show(this.cropper.trackerElem, m);
        }
    },
    
    changeCollapse: function(isit){
        var width = isit ? this.settings.fullBoxWidth : this.settings.boxWidth;
        $.log('set width: ', width);
        this.settings.collapseInitially = isit;
        this.render();
    },
    
    changePinsMode: function(m){
        m = m.get();
        if(m == 'show'){
            this.pins.show();
            this.cropper.release();
        }
        else
            this.pins.hide();
    },
    
    hidePopups: function(){
        if(this.newCommentView)
            this.newCommentView.hide();
        if(this.popupCommentView)
            this.popupCommentView.hide();
    },
    
    onAddComment: function(m){
        if(m && m.hasPosition() && (!m.get('extract') || m.get('extract').order_index == this.model.get('order_index')) && this.cropper){
            //$.log('placing pin?', m);
            var pin = new Q.PinView({
                model: m,
                selectedComment: this.settings.selectedComment,
                xscale: this.cropper.xscale,
                yscale: this.cropper.yscale
            });
            
            pin.template = this.pinTemplate;
            
            this.pins.append(pin.render().el);
            this.pinViews.push(pin);
        }
    },
    
    onSelect: function(c){
        $.log('onSelect', c, this.settings.boxWidth, 'elem', this.cropper, this.cropper.trackerElem);
        if(c.w && c.h && this.newCommentView){
            this.newCommentView.show(this.cropper.trackerElem);
        }
    },
    
    onRelease: function(){
        this.hidePopups();
        this.settings.selectedComment.set(null);
        if(this.settings.pinsMode.get() == 'show')
            this.pins.show();
    },
    
    onStart: function(){
        this.settings.selectedComment.set(null);
        this.pins.hide();
    },
    
    onCommentRefresh: function(c){
        for(var i = 0; i < this.pinViews.length; i++){
            this.pinViews[i].remove();
        }
        for(var i = 0; i < this.settings.comments.length; i++){
            this.onAddComment(this.settings.comments.models[i]);
        }
        this.waitForRefresh = false;
    },
    
    onChangeVerison: function(m){
        if(!m.get().get) return;
        //on version change, the setCropper function will be called before the refresh.
        //So we set this to not load pins until comment refresh. 
        this.waitForRefresh = true;
    },
    
    setCropper: function(cropperApi){
        this.cropper = cropperApi;
        this.newCommentView.setCropper(cropperApi);
        
        this.$('.jcrop-holder').append(this.pins);
        
        if(!this.waitForRefresh){
            for(var i = 0; i < this.settings.comments.length; i++){
                this.onAddComment(this.settings.comments.models[i]);
            }
        }
    },
    
    release: function(){
        if(this.cropper)
            this.cropper.release();
    },
    
    render: function(){
        if(this.cropper)
            this.cropper.destroy();
        
        this._super();
        
        var width = this.settings.collapseInitially ? this.settings.fullBoxWidth : this.settings.boxWidth;
        $.log('rendering with width', width, this.settings.collapseInitially);
        var img = this.$('img').Jcrop({
            onChange: this.onChange,
            onSelect: this.onSelect,
            onRelease: this.onRelease,
            onLoad: this.setCropper,
            onStart: this.onStart,
            //cornerHandles: false,
            //sideHandles: false,
            allowMove: false,
            keySupport: false,
            allowResize: false,
            boxWidth: width
        });
        
        if(!this.newCommentView){
            this.newCommentView = new Q.ImageNewCommentView({
                model: this.model.clone(),
                comments: this.settings.comments
            });
            this.newCommentView.render();
            this.newCommentView.hide();
        }
        
        if(!this.popupCommentView){
            this.popupCommentView = new Q.PopupCommentView({
                model: this.model,
                replyForm: window.replyForm
            });
            
            this.popupCommentView.render();
            this.popupCommentView.hide();
        }
        
        if(!this.pinObjs)
            this.pinObjs = [];
        
        this.pins = this.$('.pins')[this.settings.pinsMode.get()]();
        
        return this;
    }
});

Q.CommentForm = Q.Form.extend('CommentForm', {
    init: function(con, set){
        var defs = {
            validationOptions:{
                rules: {body: 'required'},
                messages: {body: 'Message please'}
            }
        };
        this._super(con, $.extend(true, {}, defs, set));
        
        _.bindAll(this, 'parseKey');
        
        var b = this.getElement('body');
        b.keypress(this.parseKey);
    },
    
    parseKey: function(e){
        var shift_down = e.shiftKey;
        switch(e.keyCode){
            case 13:
                this.form.submit();
                return false;
        }
        return true;
    }
});

Q.ImageNewCommentView = Q.PopupView.extend({
    template: '#image-comment-template',
    className: 'new-image-comment',
    
    init: function(container, settings){
        //model is a generic backbone model with a file extract in it
        var defs = {
            model: new Q.Model({}),
            comments: null //need the list of comments to add to....
        };
        this._super(container, $.extend({}, defs, settings));
        this.model = this.model || this.settings.model;
        
        _.bindAll(this, 'onSubmit');
    },
    
    setupForm: function(){
        this.form = this.$('form').CommentForm({
            validationOptions:{
                submitHandler: this.onSubmit
            }
        });
    },
    
    onSubmit: function(){
        var pos = this.cropper.tellSelect();
        pos = [pos.x, pos.y, pos.w, pos.h];
        $.log('submit', this.form.val('body'), this.model.id, pos);
        
        this.settings.comments.addComment(this.form.val('body'), this.model.id, pos);
        
        //this.cropper.release();
        
        return false;
    },
    
    setCropper: function(cropperApi){this.cropper = cropperApi;},
    show: function(){
        this._super.apply(this, arguments);
        
        this.form.reset();
        this.form.focusFirst();
    },
    
    render: function(){
        this._super();
        
        this.setupForm();
        
        return this;
    }
    
});

Q.CommentView = Q.View.extend({
    tagName: 'div',
    className: 'comment',
    template: '#comment-template',
    
    events: {
        'click .reply-box .text': 'onClickReply',
        'click .complete-indicator': 'onClickComplete'
    },
    
    tooltips:{
        open: 'Not completed; Click to complete.',
        completed: 'Completed; Click to uncomplete.'
    },
    
    init: function(container, settings){
        /**
         * Will get in settings:
         * model: Q.Comment()
         * selectedComment: 
         */
        var self = this;
        this._super(container, settings);
        _.bindAll(this, 'onAddReply', 'onSelectComment', 'onChangeCompletionStatus');
        
        if(this.model.get('position')){
            this.container.addClass('position');
            this.container.mousedown(function(e){
                e.stopPropagation();
            });
        }
        
        var replies = this.model.get('replies');
        replies.bind('add', this.onAddReply);
        replies.bind('newcomment', this.onAddReply);
        
        this.model.bind('change:completion_status', this.onChangeCompletionStatus);
        
        if(this.settings.replyForm)
            this.settings.replyForm.bind('hide', function(){
                self.$('.reply-box .text').show();
            });
        
        if(this.settings.selectedComment)
            this.settings.selectedComment.bind('change:comment', this.onSelectComment)
        
        this.model.view = this;
    },
    
    onSelectComment: function(m){
        m = m.get();
        if(m && m.get('eid') == this.model.get('eid'))
            this.container.addClass('selected');
        else{
            this.$('.reply-box .text').show();
            if(this.settings.replyForm) this.settings.replyForm.hide();
            this.container.removeClass('selected');
        }
    },
    
    onClickReply: function(e){
        var t = $(e.target);
        var elem = this.$('#'+this.settings.replyForm.container[0].id);
        this.settings.replyForm.model = this.model.get('replies');
        if(elem.length && this.settings.replyForm.container.is(':visible'))
            this.settings.replyForm.hide();
        else{
            this.settings.replyForm.container.insertAfter(t);
            this.settings.replyForm.show();
            t.hide();
        }
        return false;
    },
    
    onAddReply: function(m){
        if(this.replies && !m.isNew()){
            //this.replies.show();
            $.log('Adding reply in onAddReply', m);
            var com = new Q.CommentView({
                model: m,
                selectedComment: this.settings.selectedComment
            });
            this.replies.append(com.render().el);
            var r = this.model.get('replies');
            if(r && $.isNumber(r.length))
                this.$('.number-comments').text(r.length);
        }
        else
            $.log('NOT Adding reply as no replies yet...', m);
    },
    
    setPinStatus: function(status){
        var ind = this.$('.complete-indicator');
        ind.removeClass('status-'+this.model.statusToggle[status]);
        ind.addClass('status-'+status);
        this.container.removeClass('status-'+this.model.statusToggle[status]);
        this.container.addClass('status-'+status);
        
        ind.attr('title', this.tooltips[status]);
    },
    
    onClickComplete: function(){
        var cv = this.model.get('completion_status');
        this.setPinStatus(this.model.statusToggle[cv.status]);
        
        this.model.toggleCompleteness();
        return false;
    },
    
    onChangeCompletionStatus: function(m){
        var cv = m.get('completion_status');
        
        this.setPinStatus(cv.status);
        
        var time = this.$('>.time');
        time.find('>.completed').remove();
        
        if(cv.status == 'completed'){
            time.prepend(
                $('<div/>', {
                    'class': 'completed',
                    text: 'completed by ' + cv.user + ' ' + $.relativeDateStr($.parseDate(cv.created_date))
                })
            );
        }
    },
    
    render: function(){
        this.container[0].id = this.model.get('eid');
        var d = {
            time: $.relativeDateStr($.parseDate(this.model.get('created_date'))),
            creator: this.model.get('creator').name,
            body: this.model.get('body'),
            version: this.model.get('change_version'),
            completion_status: this.model.get('completion_status').status
        };
        this.renderTemplate(d);
        
        this.replies = this.$('.replies');
        var repl = this.model.get('replies');
        
        for(var i = 0; i < repl.length; i++){
            $.log('Adding reply in render', repl.models[i]);
            this.onAddReply(repl.models[i]);
        }
        
        if(!this.settings.replyForm)
            this.$('.reply-link').remove();
        
        this.onChangeCompletionStatus(this.model);
        
        return this;
    }
});

Q.PopupCommentView = Q.PopupView.extend({
    template: '#popup-comment-template',
    className: 'popup-comment-view',
    tagName: 'div',
    
    init: function(container, settings){
        //model is a comment
        this._super(container, settings);
        
        //_.bindAll(this, 'onSubmit');
    },
    
    show: function(referenceElem, comment){
        var com = new Q.CommentView({
            model: comment,
            replyForm: this.settings.replyForm
        });
        this.container.find('.comment-container').html(com.render().el);
        var c = new Q.SingleSelectionModel('comment');
        c.set(comment);
        com.onSelectComment(c);
        
        this._super(referenceElem);
    }
});

Q.CommentsView = Q.View.extend('CommentsView', {
    
    events:{
        'click .comment': 'onClickComment',
        'click #comments-filter a': 'onFilterClick'
    },
    
    n: {
        comments: '#comments',
        filterLinks: '#comments-filter a',
        noCommentBoxen: '.no-comments'
    },
    
    init: function(container, settings){
        /**
         * Will get in settings:
         * model: Q.Comments()
         * selectedComment: 
         */
        
        this._super(container, settings);
        _.bindAll(this, 'onAddComment', 'onNewComment', 'onRemoveComment', 'onRefresh', 'onChangeSelectedComment');
        
        var loader = this.loader = this.container.Loader();
        
        this.settings.selectedComment.bind('change:comment', this.onChangeSelectedComment)
        this.model.bind('refresh', this.onRefresh);
        this.model.bind('newcomment', this.onNewComment);
        this.model.bind('add', this.onAddComment);
        this.model.bind('remove', this.onRemoveComment);
        
        this.model.bind('request:start', function(){
            $.log('start loading');
            loader.startLoading();
        });
        this.model.bind('request:end', function(){
            $.log('stop loading');
            loader.stopLoading()
        });
        
        this.views = [];
    },
    
    onChangeSelectedComment: function(m){
        m = m.get();
        if(m){
            this.n.comments.addClass('show-selected');
            
            if(m && this.container.is(':visible') && m.get('extract') && m.hasPosition()){
                
                //this mess is to move the comment to the position of the selection if offscreen
                var pos = m.get('position');
                var imageView = window.imageViews[this.settings.selectedVersion.get().get('version')];
                
                $.log('Selected comment at', [pos[0], pos[1]], 'on', imageView, m.get('extract').order_index);
                
                imageView = imageView[m.get('extract').order_index];
                var cont = this.container.offset().top;
                var selection = imageView.container.offset().top + pos[1]/imageView.cropper.yscale;
                
                if(selection > 400){
                    
                    //set timeouts so that the comment's height gets setup before we move it.
                    setTimeout(function(){
                        var h = m.view.container.height();
                        var p = imageView.container.parent();
                        $.log('selection, max', selection, p.offset().top + p.height() - h, p, m.view.container, h);
                        
                        var css = {
                            position: 'absolute',
                            left: 0
                        };
                        
                        //if the thing would jut out lower than the image, attach it to the
                        //bottom of the image.
                        var max = (p.offset().top + p.height() - h);
                        if(max < selection)
                            css.bottom = - (p.offset().top + p.height() - cont - 40);
                        else
                            css.top = selection - cont
                        
                        m.view.container.css(css);
                        
                        setTimeout(function(){
                            m.view.container.scrollshow();
                        }, 100);
                        
                    }, 100);
                    
                }
                else
                    //selection is above the fold.
                    setTimeout(function(){
                        m.view.container.scrollshow();
                    }, 100);
                
            }
        }
        else{
            this.n.comments.removeClass('show-selected');
            this.n.comments.find('.comment').css({
                position: 'static', top: '', bottom: '', left: ''
            });
        }
    },
    
    render: function(){return this;},
    
    onFilterClick: function(e){
        var t = $(e.target);
        this.n.comments.removeClass('show-open');
        this.n.comments.removeClass('show-completed');
        this.n.comments.removeClass('show-all');
        
        this.n.comments.addClass('show-'+t.attr('rel'));
        this.n.filterLinks.removeClass('selected');
        t.addClass('selected');
        
        this.n.noCommentBoxen.hide();
        if(this.n.comments.find('.comment:visible').length == 0)
            this.$('.no-comments-'+t.attr('rel')).show();
        return false;
    },
    
    onClickComment: function(e){
        var targ = $(e.target);
        if(targ.is('a')) return true;
        
        if(!targ.is('#comments>.comment')) targ = targ.parents('#comments>.comment');
        var id = targ[0].id;
        
        var m = this.model.get(id);
        
        if(m && m.hasPosition())
            this.settings.selectedComment.set(m);
    },
    
    onNewComment: function(m){
        this.onAddComment(m);
        if(m && m.hasPosition())
            this.settings.selectedComment.set(m);
    },
    
    onAddComment: function(m){
        if(!m.isNew()){
            var view = new Q.CommentView({
                model: m,
                selectedComment: this.settings.selectedComment,
                replyForm: this.settings.replyForm
            });
            this.n.comments.append(view.render().el);
            this.views.push(view);
        }
    },
    
    onRefresh: function(){
        for(var i = 0; i < this.views.length; i++)
            this.views[i].remove();
        this.views = [];
        
        for(var i = 0; i < this.model.length; i++)
            this.onAddComment(this.model.at(i));
    },
    
    onRemoveComment: function(m){
    }
});

Q.CommentFormView = Q.View.extend('CommentFormView', {
    n: {
        commentForm: 'form'
    },
    events:{
        'click .cancel': 'addCommentCancel'
    },
    
    init: function(container, settings){
        //model is the comment collection we are adding to.
        
        this._super(container, settings);
        _.bindAll(this, 'onSubmitCommentForm');
        
        this.container.hide();
        this.form = this.n.commentForm.CommentForm({
            validationOptions:{
                submitHandler: this.onSubmitCommentForm
            }
        });
    },
    
    show: function(){
        this._super();
        this.form.focusFirst();
        this.trigger('show', this);
    },
    
    hide: function(){
        this.container.hide();
        this.form.reset();
        this.trigger('hide', this);
        $('body').append(this.container);
    },
    
    addCommentCancel: function(){
        this.hide();
        return false;
    },
    
    onSubmitCommentForm: function(){
        var self = this;
        
        $.log(self.model, self.form.val('body'));
        self.model.addComment(self.form.val('body'));
        
        this.addCommentCancel();
        return false;
    }
});

Q.PinButtonView = Q.View.extend('PinButtonView', {
    init: function(c, set){
        this._super(c, set);
        _.bindAll(this, 'setButton', 'pinToggle');
        this.model.bind('change:pins', this.setButton);
        c.click(this.pinToggle);
        
        this.pins = $('.pins');
    },
    
    setButton: function(mode){
        var targ = this.container;
        if(mode.get() == 'hide'){
            targ.removeClass('selected');
            targ.attr('title', 'Click to show annotation pins');
        }
        else{
            targ.addClass('selected');
            targ.attr('title', 'Click to hide annotation pins');
        }
    },
    
    pinToggle: function(e){
        if(this.model.get() == 'show')
            this.model.set('hide');
        else
            this.model.set('show');
        return false;
    }
});

Q.ViewFilePage = Q.Page.extend({
    n: {
        tabs: '#version-tabs',
        pageImageViewer: '#inpage-image-viewer',
        comments: '#comments-view',
        addComment: '#add-comment',
        replyComment: '#reply-comment',
        pinToggle: '#pin-toggle',
        sidepanel: '#sidepanel',
        headerVersion: '#comments-header .version, .file-meta .version',
        headerName: '.file-meta .name',
        headerTime: '.file-meta .time'
    },
    events:{
        'click #add-comment-link': 'addCommentClick'
    },
    run: function(){
        
        /**
         * If you want to upload on this page, use the Q.FileUploader
         * and use the forcedName param
         */
        var self = this;
        this._super.apply(this, arguments);
        _.bindAll(this, 'viewVersion', 'addVersion');
        
        var sidepanel = this.n.sidepanel.Sidepanel({
            collapsePreference: this.settings.collapsePreference,
            collapseInitially: this.settings.collapseInitially
        });
        
        this.versions = new Q.FileVersions([]);
        this.selectedVersion = new Q.SingleSelectionModel('version');
        this.selectedComment = new Q.SingleSelectionModel('comment');
        
        //pin junk
        this.pinsMode = new Q.SingleSelectionModel('pins');
        this.n.pinToggle.PinButtonView({model: this.pinsMode})
        this.pinsMode.set('show');
        
        this.comments = new Q.Comments([]);
        
        this.commentForm = this.n.addComment.CommentFormView({
            model: this.comments
        });
        this.replyForm = window.replyForm = this.n.replyComment.CommentFormView({
            model: null
        });
        
        this.commentsView = this.n.comments.CommentsView({
            model: this.comments,
            selectedComment: this.selectedComment,
            selectedVersion: this.selectedVersion,
            replyForm: this.replyForm
        });
        
        //do setup and binding here
        this.versions.bind('add', this.addVersion);
        
        this.pageImageViewer = this.n.pageImageViewer.ImageViewer({
            model: this.versions,
            selectedVersion: this.selectedVersion,
            selectedComment: this.selectedComment,
            pinsMode: this.pinsMode,
            comments: this.comments,
            boxWidth: this.settings.boxWidth,
            fullBoxWidth: this.settings.fullBoxWidth,
            collapseInitially: this.settings.collapseInitially,
            collapsable: sidepanel
        });
        
        //add the versions to the model
        for(var i = 0; i < this.settings.versions.length; i++){
            this.versions.add(this.settings.versions[i]);
        }
        this.selectedVersion.set(this.versions.at(0));
        
        this.comments.setCurrentVersion(this.selectedVersion.get());
        this.comments.add(this.settings.comments, {
            save: false,
            urls: this.settings.commentUrls
        });
        
        this.selectedVersion.bind('change:version', this.viewVersion);
        
        $.log(this.comments);
    },
    
    addCommentClick: function(){
        if(this.commentForm.container.is(':visible'))
            this.commentForm.addCommentCancel();
        else{
            this.commentForm.show();
            this.commentForm.form.focusFirst();
        }
        return false;
    },
    
    addVersion: function(m){
        $.log('add version', m);
        this.n.tabs.append(new Q.TabView({
            model: m,
            selectedVersion: this.selectedVersion
        }).render().container);
    },
    
    viewVersion: function(m){
        if(!m.get().get) return;
        
        //m.version is a FileVersion model
        var version = m.get();
        $.log('View version', version);
        this.comments.fetchForVersion(version);
        
        this.n.headerVersion.text(version.get('version'));
        this.n.headerName.text(m.get('creator').name);
        this.n.headerTime.text($.relativeDateStr($.parseDate(version.get('created_date'))));
    }
});

})(jQuery);
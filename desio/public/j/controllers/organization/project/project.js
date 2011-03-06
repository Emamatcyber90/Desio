/**
 * JS for viewing or creating a project 
 */

;(function($){

Q.DirectoryTreeView = Q.View.extend('DirectoryTreeView', {
    template: '#dir-tree-template',
    className: 'dir-tree',
    
    init: function(c, set){
        this._super(c, set);
        _.bindAll(this, 'addDirectory', 'changeCurrent');
        
        this.model.get('children').bind('add', this.addDirectory);
        this.model.bind('change:current', this.changeCurrent)
    },
    
    render: function(){
        this.children = this.$('.children');
        
        if(!this.children.length){
            this._super();
            this.children = this.$('.children');
        }
        if(!this.model.isRoot())
            this.children.hide();
        
        var children = this.model.get('children');
        for(var i = 0; i < children.length; i++)
            this.addDirectory(children.models[i]);
        
        return this;
    },
    
    changeCurrent: function(m){
        //if(this.model.get('current')){
            if(!this.$('.current').length) this.container.addClass('current');
            this.children.show();
        //}
    },
    
    addDirectory: function(m){
        var view = new Q.DirectoryTreeView({model: m});
        this.children.append(view.render().el);
    }
});

Q.ViewProjectPage = Q.Page.extend({
    events:{
        'click #add-directory-link': 'addDirectory'
    },
    n: {
        root: '#root-directory',
        sidepanel: '#sidepanel'
    },
    run: function(){
        var self = this;
        this._super.apply(this, arguments);
        
        this.filesModule = $(this.settings.module).FilesModule(this.settings);
        this.n.sidepanel.Sidepanel({
            collapsePreference: this.settings.collapsePreference,
            collapseInitially: this.settings.collapseInitially
        });
        
        var root = new Q.Directory({
            name: '',
            path: '/', full_path: '/',
            children: this.settings.tree.directories
        });
        
        this.directories = root.get('children'); //will be a Q.Directories obj
        
        this.root = this.n.root.DirectoryTreeView({model: root});
        this.root.render();
        
        //need to walk the tree to find the current path
        var dir = this.currentDirectory = this.directories.findPath(this.settings.path);
        if(dir) dir.set({current: true});
        else this.currentDirectory = root;
    },
    
    addDirectory: function(e){
        var l = $(e.target);
        var n = prompt('What do you want to name this directory?');
        
        var dirs = this.currentDirectory.get('children');
        for(var i = 0; i < dirs.length; i++)
            if(dirs.models[i].get('name') == n){
                n = null;
                Q.warn('Directory already exists!');
            }
        
        if(n){
            $.postJSON(l[0].href, {
                path: $.pathJoin(this.settings.path, n)
            }, function(data){
                data = data.results;
                $.log(data);
                dirs.add(data);
            });
        }
        return false;
    }
});

Q.ProjectCreatePage = Q.Page.extend({
    run: function(){
        var self = this;
        this._super.apply(this, arguments);
        _.bindAll(this, 'success', 'synced');
        this.form = this.$('#new-form').AsyncForm({
            validationOptions: {
                rules:{
                    name: 'required',
                    description: {required: false}
                }
            },
            submitters: '#create-project-link',
            onSuccess: function(data){self.success(data);}
        });
        this.form.focusFirst();
        
        this.projectUserModule = $('#project-user-module').ProjectUserModule(this.settings);
        this.projectUserModule.bind('synced', this.synced);
    },
    
    success: function(data){
        $.log(data);
        this.form.loader.startLoading();
        this.project = data.results;
        this.projectUserModule.sync(data.results.eid);
    },
    
    synced: function(){
        $.log('redirecting to /project/'+this.project.slug);
        
        this.form.loader.stopLoading();
        $.redirect('/project/'+this.project.slug);
    }
});


})(jQuery);
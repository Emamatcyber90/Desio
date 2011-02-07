from desio import api
from desio.lib.base import *
from desio.lib import modules
from desio.model import users, projects, STATUS_APPROVED
from desio.api import authorize
from desio.controllers.api import v1

import formencode
import formencode.validators as fv

import sqlalchemy as sa

from pylons_common.lib.decorators import *

def has_project():
    
    """
    
    """
    @stackable
    def decorator(fn):
        @zipargs(fn)
        def new(**kwargs):
            
            kwargs['project'] = c.project = api.project.get(c.real_user, c.user, c.organization, project=kwargs.get('slug'))
            
            if c.project:
                c.project_role = c.project.get_role(c.user)
                c.is_project_admin = c.user_role in [projects.PROJECT_ROLE_ADMIN]
                c.is_project_writer = c.user_role in [projects.PROJECT_ROLE_ADMIN, projects.PROJECT_ROLE_WRITE]
                c.is_project_reader = c.project_role != None
            
            return fn(**kwargs)
            
        return new
    return decorator

class ProjectController(OrganizationBaseController):
    """
    """
    
    @authorize(CanContributeToOrgRedirect())
    def new(self, **kw):
        c.title = 'New Project'
        c.project_user_module_params = modules.project.project_user_module(c.real_user, c.user, c.organization)
        return self.render('/organization/project/new.html')
    
    @has_project()
    @authorize(CanReadProjectRedirect())
    def view(self, slug=None, path=u'/', project=None, **kw):
        
        print path
        if not path: abort(404)
        
        if path[0] != u'/': path = u'/'+path #add pre slash
        if len(path) > 1 and path[-1] == '/': path = path[:-1] #remove trailing slash
        
        view_dir = True
        entity = None
        if path != '/':
            entity = project.get_entities(path)
            if not entity: abort(404)
            
            view_dir = entity.type == projects.Directory.TYPE
        
        if view_dir:
            return self._view_directory(entity, project, path)
        else:
            return self._view_file(entity, project, path)
    
    def _view_file(self, entity, project, path):
        c.title = project.name + (path != u'/' and path or '')
        
        logger.info('viewing FILE %s %s' % (path, entity))
        
        file = api.file.get(c.real_user, c.user, project, path, version='all')
        c.file = v1.file.get().output(file)
        
        c.path = path
        
        return self.render('/organization/project/view_file.html')
    
    def _view_directory(self, entity, project, path):
        c.title = project.name + (path != u'/' and path or '')
        
        struc = api.project.get_structure(c.real_user, c.user, c.project, path)
        if not struc: abort(404)
        
        c.structure = v1.project.get_structure().output(struc)
        c.path = path
        
        return self.render('/organization/project/view.html')
    
    
    ##
    ### project settings (Should be separate controller...)
    ##
    
    def settings_index(self, **kw):
        return self.settings_general(**kw)
    
    @has_project()
    @authorize(CanContributeToOrgRedirect())
    def settings_users(self, project=None, **kw):
        c.tab = 'Users'
        c.title = project.name + ' Settings'
        c.project_user_module_params = modules.project.project_user_module(c.real_user, c.user, c.organization, project=project)
        return self.render('/organization/project/settings/users.html')
    
    @has_project()
    @authorize(CanContributeToOrgRedirect())
    def settings_general(self, project=None, **kw):
        c.tab = 'General'
        c.title = project.name + ' Settings'
        
        return self.render('/organization/project/settings/general.html')
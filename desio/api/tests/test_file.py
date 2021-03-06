from datetime import date, timedelta

from desio import api
from desio.model import users, fixture_helpers as fh, projects, STATUS_APPROVED, STATUS_COMPLETED, STATUS_OPEN
from desio.tests import *

from pylons_common.lib.exceptions import *

class TestFile(TestController):
    
    def test_edit(self):
        
        user = fh.create_user()
        project = fh.create_project(user=user, name=u"helloooo")
        self.flush()

        filepath = file_path('ffcc00.gif')
        change = project.add_change(user, u"/wowza/foobar.gif", filepath, u"this is a new change")
        self.flush()
        filepath = file_path('ffcc00.gif')
        change2 = project.add_change(user, u"/wowza/kittens.gif", filepath, u"this is a new change")
        self.flush()
        
        r, change = api.file.get(user, user, project.eid, path=u"/wowza/foobar.gif")
        kittens, change2 = api.file.get(user, user, project.eid, path=u"/wowza/kittens.gif")
        directory = Session.query(projects.Entity).filter_by(name='wowza', project=project).first()
        
        assert directory
        assert r.name == 'foobar.gif'
        eid = r.eid
        
        r = api.file.edit(user, user, eid, name=u"somethingelse.gif")
        self.flush()
        
        assert r.name == 'somethingelse.gif'
        
        r, change = api.file.get(user, user, project.eid, path=u"/wowza/somethingelse.gif")
        
        assert r.name == 'somethingelse.gif'
        assert eid == r.eid
        
        #change again to same thing...
        r = api.file.edit(user, user, eid, name=u"somethingelse.gif")
        assert r
        
        r = self.throws_exception(lambda: api.file.edit(user, user, kittens.eid, name=u"somethingelse.gif"))
        assert 'name' in r.error_dict
        
        self.login(user)
        r = self.client_async(api_url('file', 'edit', id=kittens.eid), {'name': 'cats.gif'})
        assert r.results
        assert r.results.name == 'cats.gif'
        
        r = self.client_async(api_url('file', 'edit', id=kittens.eid), {'key': 'name', 'value': 'meow.gif'})
        assert r.results
        assert r.results.name == 'meow.gif'
        
        r = self.client_async(api_url('file', 'edit', id=directory.eid), {'key': 'name', 'value': 'omg'})
        assert r.results
        assert r.results.name == 'omg'
        
        r, change = api.file.get(user, user, project.eid, path=u"/omg/meow.gif")
        assert r.eid == kittens.eid
    
    def test_get(self):
        
        user = fh.create_user()
        project = fh.create_project(user=user, name=u"helloooo")
        self.flush()

        filepath = file_path('ffcc00.gif')
        change = project.add_change(user, u"/foobar.gif", filepath, u"this is a new change")
        self.flush()
        
        r, change = api.file.get(user, user, project.eid, path=u"/foobar.gif")
        #print r.results
        
        assert r.name
        assert r.eid
        assert change.version
        assert r.path
        assert change.change_extracts
    
    def test_comments(self):
        
        rando = fh.create_user()
        reader = fh.create_user()
        user = fh.create_user()
        guy_in_project = fh.create_user()
        project = fh.create_project(user=user, name=u"helloooo")
        self.flush()
        
        project.organization.attach_user(guy_in_project, status=STATUS_APPROVED)
        project.organization.attach_user(reader, status=STATUS_APPROVED)
        assert api.project.attach_user(user, user, project, guy_in_project, projects.APP_ROLE_WRITE)
        assert api.project.attach_user(user, user, project, reader, projects.APP_ROLE_READ)
        
        filepath = file_path('ffcc00.gif')
        change = project.add_change(user, u"/foobar.gif", filepath, u"this is a new change")
        self.flush()
        
        extract = change.change_extracts[0]
        
        _extract, comment = api.file.add_comment(user, user, 'My comment!', extract=extract.id, x=23, y=345, width=10, height=20)
        self.flush()
        
        assert _extract == extract
        assert comment.change == change
        assert comment.change_extract == extract
        
        assert comment.body == u'My comment!'
        assert comment.eid
        assert comment.x == 23
        assert comment.y == 345
        assert comment.width == 10
        assert comment.height == 20
        assert comment.completion_status.status == STATUS_OPEN
        
        #make sure comment completion statuses work
        api.file.set_comment_completion_status(user, user, comment, status=STATUS_COMPLETED)
        self.flush()
        assert comment.completion_status.status == STATUS_COMPLETED
        
        api.file.set_comment_completion_status(user, guy_in_project, comment, status=STATUS_OPEN)
        self.flush()
        assert comment.completion_status.status == STATUS_OPEN
        
        ex = self.throws_exception(lambda: api.file.set_comment_completion_status(user, user, None, status=STATUS_COMPLETED))
        assert ex.code == NOT_FOUND
        ex = self.throws_exception(lambda: api.file.set_comment_completion_status(user, user, comment))
        assert 'status' in ex.error_dict
        ex = self.throws_exception(lambda: api.file.set_comment_completion_status(reader, reader, comment, status=STATUS_COMPLETED))
        assert ex.code == FORBIDDEN
        
        _, reply = api.file.add_comment(user, user, 'My reply!', change=change.eid, in_reply_to=comment.eid)
        self.flush()
        
        assert reply
        assert reply.in_reply_to == comment
        assert reply.eid
        
        assert comment.replies
        assert len(comment.replies) == 1
        
        _change, comments = api.file.get_comments(user, user, change=change.eid)
        
        assert change == _change
        assert len(comments) == 2
        assert comments[0] == comment
        assert comments[1] == reply
        assert comments[0].replies[0] == reply
        
        _, guyscomment = api.file.add_comment(guy_in_project, guy_in_project, 'My comment!', extract=extract.id, x=23, y=345, width=10, height=20)
        _, guyscomment1 = api.file.add_comment(guy_in_project, guy_in_project, 'My comment!', extract=extract.id, x=23, y=345, width=10, height=20)
        self.flush()
        
        ex = self.throws_exception(lambda: api.file.remove_comment(guy_in_project, guy_in_project, comment.eid)).code == FORBIDDEN
        ex = self.throws_exception(lambda: api.file.remove_comment(rando, rando, guyscomment.eid)).code == FORBIDDEN
        
        _, comments = api.file.get_comments(user, user, change=change.eid)
        assert len(comments) == 4
        
        assert api.file.remove_comment(user, user, guyscomment.eid)
        assert api.file.remove_comment(guy_in_project, guy_in_project, guyscomment1.eid)
        self.flush()
        
        _, comments = api.file.get_comments(user, user, change=change.eid)
        assert len(comments) == 2
        
        ex = self.throws_exception(lambda: api.file.get_comments(user, user))
        assert ex.exceptions[0].code == NOT_FOUND
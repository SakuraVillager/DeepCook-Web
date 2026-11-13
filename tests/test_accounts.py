import io
import json
import sys
import tempfile
import unittest
import uuid
from http.cookies import SimpleCookie
from pathlib import Path
from PIL import Image

sys.path.insert(0,str(Path(__file__).parents[1]/'server'))
from community import CommunityApp, PREFIX
from account_data import empty_data

ORIGIN = 'https://cook.example.com'
PASSWORD = 'a long kitchen password 123'


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.app = CommunityApp(Path(self.temp.name)/'community.sqlite3',['r'],[ORIGIN],rate_limits=False,reserve_bytes=0)

    def tearDown(self):
        self.app.db.close(); self.temp.cleanup()

    def request(self,path,method='GET',data=None,cookie='',guest='a'*64,origin=ORIGIN,expected_account=None):
        raw = data if isinstance(data,bytes) else json.dumps(data,ensure_ascii=False).encode() if data is not None else b''
        env = {'PATH_INFO':PREFIX+path,'QUERY_STRING':'','REQUEST_METHOD':method,'CONTENT_LENGTH':str(len(raw)),
               'CONTENT_TYPE':'image/jpeg' if isinstance(data,bytes) else 'application/json','wsgi.input':io.BytesIO(raw),
               'HTTP_ORIGIN':origin,'HTTP_COOKIE':cookie,'HTTP_AUTHORIZATION':'Bearer '+guest if guest else '', 'REMOTE_ADDR':'127.0.0.1'}
        if expected_account:env['HTTP_X_DEEPCOOK_ACCOUNT']=expected_account
        result={}
        def start(status,headers):result.update(status=int(status.split()[0]),headers=dict(headers))
        raw=b''.join(self.app(env,start))
        result['body']=json.loads(raw) if raw and result['headers']['Content-Type'].startswith('application/json') else raw
        return result

    def register(self,name='tester',claim=False,guest='a'*64):
        result=self.request('/auth/register','POST',{'username':name,'password':PASSWORD,'name':'小厨房','claimGuest':claim},guest=guest)
        self.assertEqual(result['status'],200,result['body'])
        cookies=SimpleCookie();cookies.load(result['headers']['Set-Cookie'])
        name=self.app.accounts.cookie_name
        return name+'='+cookies[name].value,result['body']['account']

    def upload(self,cookie):
        output=io.BytesIO();Image.new('RGB',(400,400),(180,90,30)).save(output,'JPEG')
        result=self.request('/account/media','PUT',output.getvalue(),cookie=cookie)
        self.assertEqual(result['status'],200,result['body'])
        return result['body']['photoUrl']

    def save(self,cookie,data,revision=0,mutation=None):
        return self.request('/account/data','PUT',{'revision':revision,'data':data,'mutationId':mutation or str(uuid.uuid4())},cookie=cookie)

    def test_registration_cookie_password_hash_login_logout_and_expiry(self):
        cookie,account=self.register('Tester')
        self.assertEqual(account['username'],'tester')
        session=self.request('/auth/session',cookie=cookie)
        self.assertEqual(session['body']['account']['id'],account['id'])
        self.assertIn('no-store',session['headers']['Cache-Control'])
        stored=self.app.db.execute('SELECT password_hash FROM accounts').fetchone()[0]
        self.assertTrue(stored.startswith('pbkdf2_sha256$600000$'));self.assertNotIn(PASSWORD,stored)
        self.assertNotEqual(self.app.db.execute('SELECT token_hash FROM sessions').fetchone()[0],cookie.split('=')[1])
        duplicate=self.request('/auth/register','POST',{'username':'TESTER','password':PASSWORD,'claimGuest':False})
        self.assertEqual(duplicate['status'],409)
        for username in ['tester','unknown']:
            denied=self.request('/auth/login','POST',{'username':username,'password':'an incorrect password here','claimGuest':False})
            self.assertEqual(denied['status'],401);self.assertEqual(denied['body']['error'],'用户名或密码不正确。')
        result=self.request('/auth/login','POST',{'username':'TESTER','password':PASSWORD,'claimGuest':False})
        self.assertEqual(result['status'],200)
        for value in ['HttpOnly','Secure','SameSite=Lax']:self.assertIn(value,result['headers']['Set-Cookie'])
        self.request('/auth/logout','POST',cookie=cookie)
        self.assertIsNone(self.request('/auth/session',cookie=cookie)['body']['account'])
        self.assertEqual(self.request('/recipes/r/rating','PUT',{'score':8},cookie=cookie,expected_account=account['id'])['status'],401)
        self.app.db.execute('UPDATE sessions SET expires_at=0')
        self.assertIsNone(self.request('/auth/session',cookie=result['headers']['Set-Cookie'].split(';')[0])['body']['account'])

    def test_six_character_password_registers_and_logs_in_but_invalid_lengths_are_rejected(self):
        for password in ['12345', 'x' * 129, None]:
            for path in ['/auth/register', '/auth/login']:
                with self.subTest(path=path, password_length=len(password) if isinstance(password,str) else None):
                    result=self.request(path,'POST',{'username':'shortpass','password':password,'claimGuest':False})
                    self.assertEqual(result['status'],400)
                    self.assertEqual(result['body']['error'],'密码需为 6–128 个字符。')
        self.assertEqual(self.app.db.execute('SELECT COUNT(*) FROM accounts').fetchone()[0],0)
        body={'username':'shortpass','password':'123456','claimGuest':False}
        registered=self.request('/auth/register','POST',body)
        self.assertEqual(registered['status'],200,registered['body'])
        self.request('/auth/logout','POST',cookie=registered['headers']['Set-Cookie'].split(';')[0])
        logged_in=self.request('/auth/login','POST',body)
        self.assertEqual(logged_in['status'],200,logged_in['body'])
        self.assertEqual(logged_in['body']['account']['id'],registered['body']['account']['id'])

    def test_guest_claim_is_optional_and_existing_account_rating_wins(self):
        post='post-'+str(uuid.uuid4())
        self.request('/recipes/r/rating','PUT',{'score':8})
        self.request('/recipes/r/posts','POST',{'id':post,'text':'之前的访客评论','submission':False})
        cookie,account=self.register(claim=True)
        feed=self.request('/recipes/r',cookie=cookie)['body']
        self.assertEqual(feed['ownRating'],8);self.assertTrue(feed['posts'][0]['mine'])
        self.assertEqual(self.request('/recipes/r/posts/'+post,'DELETE',guest='a'*64)['status'],403)
        self.request('/recipes/r/rating','PUT',{'score':10},cookie=cookie)
        self.request('/recipes/r/rating','PUT',{'score':6},guest='b'*64)
        result=self.request('/auth/login','POST',{'username':'tester','password':PASSWORD,'claimGuest':True},guest='b'*64)
        other_cookie=result['headers']['Set-Cookie'].split(';')[0]
        self.assertEqual(self.request('/recipes/r',cookie=other_cookie)['body']['ownRating'],10)
        self.assertEqual(sum(self.request('/recipes/r')['body']['ratingCounts']),1)
        self.assertEqual(self.request('/auth/session',cookie=other_cookie)['body']['account']['id'],account['id'])
        guest_post='post-'+str(uuid.uuid4())
        self.request('/recipes/r/posts','POST',{'id':guest_post,'text':'保持访客身份','submission':False},guest='c'*64)
        self.register('another',claim=False,guest='c'*64)
        self.assertTrue(next(p for p in self.request('/recipes/r',guest='c'*64)['body']['posts'] if p['id']==guest_post)['mine'])

    def test_private_profile_preferences_recipes_and_images_are_isolated_and_backed_up(self):
        cookie,account=self.register()
        image=self.upload(cookie)
        data=empty_data('云端昵称')
        data['profile'].update(avatar=image,likes=['甜'],avoids=['辣'])
        data['preferences'].update(theme='dark',readingSize='large',keepScreenOn=True)
        data['favorites']=[{'recipeId':'r','timestamp':1700000000000}]
        data['recent']=[{'recipeId':'r','timestamp':1700000000001}]
        recipe=json.loads((Path(__file__).parents[1]/'public/catalog/recipes.json').read_text())[0]
        recipe.update(id='user-'+str(uuid.uuid4()),cover=image)
        recipe['steps'][0]['image']=image
        data['recipes']=[recipe]
        saved=self.save(cookie,data)
        self.assertEqual(saved['status'],200,saved['body']);self.assertEqual(saved['body']['data'],data)
        self.assertEqual(self.request('/account/data',cookie=cookie)['body']['data'],data)
        self.assertEqual(self.request(image.removeprefix(PREFIX),cookie=cookie)['status'],200)
        self.assertEqual(self.request(image.removeprefix(PREFIX))['status'],401)
        other,_=self.register('other')
        self.assertEqual(self.request(image.removeprefix(PREFIX),cookie=other)['status'],404)
        self.assertEqual(self.request('/account/data',cookie=other)['body']['data']['recipes'],[])
        stolen=empty_data();stolen['profile']['avatar']=image
        self.assertEqual(self.save(other,stolen)['status'],400)
        snapshot=self.app.backups/self.app.backup()['snapshot']
        media_name=image.rsplit('/',1)[1]
        self.assertTrue((snapshot/'account-media'/media_name).exists())
        self.assertEqual(self.save(cookie,empty_data('清理后'),revision=1)['status'],200)
        self.assertEqual(self.request(image.removeprefix(PREFIX),cookie=cookie)['status'],404)
        self.assertFalse((self.app.accounts.media/media_name).exists())
        self.assertTrue((snapshot/'account-media'/media_name).exists())

    def test_revision_conflicts_and_retried_mutations_never_double_apply(self):
        cookie,_=self.register()
        data=empty_data('第一次保存');operation=str(uuid.uuid4())
        self.assertEqual(self.save(cookie,data,mutation=operation)['status'],200)
        conflict=self.save(cookie,empty_data('其他设备'),revision=0)
        self.assertEqual(conflict['status'],409)
        replay=self.save(cookie,empty_data('不应覆盖'),revision=0,mutation=operation)
        self.assertEqual(replay['status'],200);self.assertEqual(replay['body']['data'],data);self.assertEqual(replay['body']['revision'],1)
        latest=self.request('/account/data',cookie=cookie)['body']
        latest['data']['preferences']['showStepImages']=False
        self.assertEqual(self.save(cookie,latest['data'],revision=latest['revision'])['status'],200)
        self.assertEqual(self.request('/account/data',cookie=cookie)['body']['revision'],2)

    def test_android_extension_and_step_timing_preserve_web_fields_and_picture_ownership(self):
        cookie,_=self.register()
        picture=self.upload(cookie)
        data=empty_data('跨端厨房')
        recipe=json.loads((Path(__file__).parents[1]/'public/catalog/recipes.json').read_text())[0]
        recipe['id']='user-'+str(uuid.uuid4())
        recipe['steps'][0].update(minutes=5,kind='PASSIVE')
        data['recipes']=[recipe]
        data['android']={'schema':1,'preferences':{'voiceInputEnabled':False,'colorSource':'DYNAMIC'},
                         'foodSetup':{'completed':True,'profile':{'cuisines':['中式家常']}},
                         'dishNotes':[],'coverOverrides':{'r':picture},
                         'privateCommunity':{recipe['id']:{'score':9,'posts':[{'id':'post-'+str(uuid.uuid4()),'text':'自己的笔记','submission':True,'photo':picture,'createdAt':1700000000000}]}}}
        saved=self.save(cookie,data)
        self.assertEqual(saved['status'],200,saved['body'])
        self.assertEqual(self.request('/account/data',cookie=cookie)['body']['data'],data)
        # Web clients update the common fields without dropping the opaque Android extension.
        data['profile']['likes']=['清淡']
        self.assertEqual(self.save(cookie,data,revision=1)['status'],200)
        self.assertEqual(self.request('/account/data',cookie=cookie)['body']['data']['android'],data['android'])
        other,_=self.register('other')
        self.assertEqual(self.save(other,data)['status'],400)
        for key,value in [('schema',2),('privateCommunity',{'r':{'score':9,'posts':[]}}),('coverOverrides',{'r':'file:///private/photo.jpg'})]:
            invalid=json.loads(json.dumps(data));invalid['android'][key]=value
            self.assertEqual(self.save(cookie,invalid,revision=2)['status'],400)
        invalid=json.loads(json.dumps(data));invalid['recipes'][0]['steps'][0]['kind']='UNKNOWN'
        self.assertEqual(self.save(cookie,invalid,revision=2)['status'],400)
        self.assertEqual(self.request('/account/data',cookie=cookie)['body']['revision'],2)

    def test_change_password_verifies_current_and_revokes_other_sessions(self):
        cookie,account=self.register()
        other=self.request('/auth/login','POST',{'username':'tester','password':PASSWORD,'claimGuest':False})
        other_cookie=other['headers']['Set-Cookie'].split(';')[0]
        denied=self.request('/auth/change-password','POST',{'currentPassword':'incorrect','newPassword':'cook26'},cookie=cookie)
        self.assertEqual(denied['status'],400)
        self.assertEqual(self.request('/auth/session',cookie=other_cookie)['body']['account']['id'],account['id'])
        changed=self.request('/auth/change-password','POST',{'currentPassword':PASSWORD,'newPassword':'cook26'},cookie=cookie)
        self.assertEqual(changed['status'],200,changed['body'])
        self.assertEqual(self.request('/auth/session',cookie=cookie)['body']['account']['id'],account['id'])
        self.assertIsNone(self.request('/auth/session',cookie=other_cookie)['body']['account'])
        self.assertEqual(self.request('/auth/login','POST',{'username':'tester','password':PASSWORD,'claimGuest':False})['status'],401)
        self.assertEqual(self.request('/auth/login','POST',{'username':'tester','password':'cook26','claimGuest':False})['status'],200)

    def test_validation_csrf_and_account_header_cannot_bypass_ownership(self):
        cookie,account=self.register()
        self.assertEqual(self.request('/auth/logout','POST',cookie=cookie,origin='https://evil.example')['status'],403)
        self.assertEqual(self.request('/auth/logout','POST',cookie=cookie,origin='')['status'],403)
        self.assertEqual(self.request('/account/data',cookie=cookie,expected_account='someone-else')['status'],401)
        invalid=empty_data();invalid['profile']['avatar']='https://evil.example/image.jpg'
        self.assertEqual(self.save(cookie,invalid)['status'],400)
        invalid=empty_data();invalid['profile']['likes']=['辣'];invalid['profile']['avoids']=['辣']
        self.assertEqual(self.save(cookie,invalid)['status'],400)
        invalid=empty_data();invalid['recent']=[{'recipeId':'r','timestamp':-1}]
        self.assertEqual(self.save(cookie,invalid)['status'],400)
        self.assertEqual(self.request('/account/media','PUT',b'not a jpeg',cookie=cookie)['status'],400)
        self.assertEqual(self.request('/recipes/r/rating','PUT',{'score':8},expected_account=account['id'])['status'],401)


if __name__=='__main__':unittest.main()

from playwright.sync_api import sync_playwright
B="http://localhost:3000";O="/workspace/worldcourses/shots/"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    def shot(name,url,login=None,w=1440):
        c=b.new_context(viewport={"width":w,"height":900});pg=c.new_page()
        if login: pg.request.post(B+"/api/login",data={"email":login[0],"password":login[1]})
        pg.goto(B+url);pg.wait_for_timeout(3500)
        pg.add_style_tag(content=".header{position:relative}*{animation:none!important}")
        pg.screenshot(path=O+name,full_page=True);c.close()
    shot("home-pt.png","/?lang=pt")
    shot("home-en.png","/?lang=en")
    shot("home-fr.png","/?lang=fr")
    shot("home-mobile-pt.png","/?lang=pt",w=390)
    shot("course-paywall.png","/course.html?id=5&paywall=1&lang=pt")
    shot("course-unlocked-student.png","/course.html?id=2&lesson=5&lang=pt",login=("aluno@worldcourses.test","Aluno123!"))
    shot("login-signup.png","/login.html?mode=signup&lang=pt")
    shot("creator-dashboard.png","/creator.html?lang=pt",login=("mariana@worldcourses.test","Criador123!"))
    shot("admin-payouts.png","/admin.html?lang=pt",login=("admin@worldcourses.test","Admin123!"))
    b.close()

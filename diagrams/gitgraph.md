```mermaid
gitGraph LR:
   commit id: "870d8f4 Structure Created"

   branch glassmorphism
   checkout glassmorphism
   commit id: "a2db70b Glassmorphism UI"

   branch hariom
   checkout hariom
   commit id: "340dfb6 Added apps for each module"
   commit id: "301ec6c Backend models, views, serializers, Keycloak, Nginx, Docker, PostgreSQL"
   commit id: "297e027 Fixed: CSS not loading on admin page (nginx)"
   commit id: "52ec894 Added django admin panel for all models"
   commit id: "3b0f317 Update README"
   commit id: "b945ea6 Fixed bug: marketplace listing & help delivery"

   branch aritra
   checkout aritra
   commit id: "7f4b459 Help&Delivery Created"
   commit id: "d944ab9 Help&Delivery Updated: Edit & Delete, UI, Sort, PhoneNo"
   commit id: "45f4d7c Help & Delivery Done"
   commit id: "6618ef6 Implemented Food and Delivery"
   commit id: "50fb8f4 Updated Food and Delivery"
   commit id: "8bd2da3 Food and Delivery Done"
   commit id: "c0cb6ac Lost & Found Implemented"
   commit id: "f477699 Lost and Found 2"
   commit id: "460e76e Lost & Found 3"
   commit id: "437d41d Lost and Found Done"
   commit id: "ee69f0b Mess updated"
   commit id: "8b2556a Mess updated 2"
   commit id: "1de32dd Mess updated 3"
   commit id: "79cebda Mess updated: fix black screen"
   commit id: "999bac3 Default Hostel + Admin Mess fixed"
   commit id: "3ebf26f Rebate Fixed"
   commit id: "4a75908 Mess Frontend changed"
   commit id: "84f1d51 User Info Section Upgraded"
   commit id: "2a82280 Hospital Section Added"
   commit id: "c1d375e Hospital Section Modified"
   commit id: "8da29fb Login Sign Up Photo Modified"
   commit id: "49d084c Profile Modified"
   commit id: "afe7320 Keycloak added"
   commit id: "0d76a5e Keycloak - NPM Default 5173 added"
   commit id: "aeec499 Keycloak Login/Pass Theme Customized"
   commit id: "f4051b9 Telegram Bot Added - Food&Delivery"
   commit id: "17901ec run script simple"
   commit id: "f107147 Run.sh and README: Keycloak & Django Sync, Pass length >= 8"
   commit id: "1707f35 Updated README"
   commit id: "abe6b80 Admin-console Outlet added"
   commit id: "583ee0b Added Windows Run Script"
   commit id: "aa8e693 Business Logic"
   commit id: "bf0c633 Old Test Cases"
   commit id: "4191efc New Test Cases"
   commit id: "16c07df ER Schema"
   commit id: "1166dbd PostgreSQL added"
   commit id: "0dcf5d2 Login Admin Sync"
   commit id: "2c46a80 Frontend Skeleton Created" tag: "origin/aritra"

   checkout main
   merge aritra id: "9461c8e Django Secret Key -> env, Views.py -> views/components" tag: "HEAD main"
```

HAMR — Caster Mobility Research

Academic project website: hardware, ROS 2, visual navigation, controllers,
and simulation experiments comparing ball and wheelchair casters.

GitHub Pages address once enabled:
https://kaifanyu.github.io/hamr-research/

PUBLISHING
In repository Settings > Pages, select Deploy from a branch, main, /(root).
Commits to main then update the website automatically. The .nojekyll file
serves the static site directly; no build tool or package install is needed.

LOCAL PREVIEW
Run: python3 -m http.server 8000
Open: http://localhost:8000

EDITING
index.html          Home, interactive 3D robot, hardware overview
ros2.html           Nodes and topic connections
vslam.html          Visual navigation pipeline
controllers.html    Control loops and encoder instrumentation
experiments.html    Trajectory plots, videos, and comparison results
assets/site.css     Shared typography, layout, and warm color palette
assets/viewer.css   Interactive robot viewer styles
assets/robot-viewer.js  Procedural robot geometry and illustrative motion

Keep relative links and the assets directory structure intact. Replace
placeholder paper details and result slots with verified publication data.
The driving animation illustrates the mechanism; it is not measured dynamics.

The site includes the vendored Three.js license and font licenses in assets.

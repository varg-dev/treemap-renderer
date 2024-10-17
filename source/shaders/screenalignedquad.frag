
precision highp float;
precision lowp int;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else
    layout(location = 0) out vec4 fragColor;
#endif

#include ./facade.frag.glsl;

varying float v_radius;
varying vec2 v_uv; // values in range [0, v_extent]
varying vec2 v_extent;
varying float v_pointyCornerLeft; // 0 for right, 1 for left
varying float v_pointyCornerBottom; // 0 for top, 1 for bottom

const float ALPHA = 0.8;
const vec3 COLOR = vec3(1.0);

void main(void)
{
    /* Instead of rendering normal quads, we want to render each quad with rounded corners, so that the
     * quads have the shape of a 2D "pill". Moreover, there will be one corner that retains its pointy
     * shape (in summary, a quad will look like a very simplified speech bubble.)
     * To get the rounded sides of the pill, we will use 2 circles (one left, one right) with the radius
     * `v_radius`, which is half of the quads's vertical extent.
     * This code is optimized to avoid conditioned branching (if-else), and uses * and + instead of
     * && and ||, respectively.
     */

    // middle points of the circle we use to calculate the rounded corners
    vec2 mLeft =  vec2(v_radius);
    vec2 mRight = vec2(v_extent.x - v_radius, v_radius);

    // define where the borders start, so that we use the correct half of the circle
    float borderLeft =   step(v_uv.x, mLeft.x);
    float borderBottom = step(v_uv.y, mLeft.y);
    float borderRight =  step(mRight.x, v_uv.x);
    float borderTop =    step(mRight.y, v_uv.y);

    float alphaLeft =  step(v_radius, distance(v_uv, mLeft))  * borderLeft;
    float alphaRight = step(v_radius, distance(v_uv, mRight)) * borderRight;

    // If we combine both alphaLeft and alphaRight, we get the pill shape. However, we want one corner
    // to stay pointy, so we separate the alpha by the 4 border areas:
    float alphaLeftBottom =  alphaLeft  * borderBottom;
    float alphaLeftTop =     alphaLeft  * borderTop;
    float alphaRightBottom = alphaRight * borderBottom;
    float alphaRightTop =    alphaRight * borderTop;

    // don't apply the rounded corner where the pointy corner should be
    float pointyLeftBottom =         v_pointyCornerLeft  *        v_pointyCornerBottom;
    float pointyLeftTop =            v_pointyCornerLeft  * (1.0 - v_pointyCornerBottom);
    float pointyRightBottom = (1.0 - v_pointyCornerLeft) *        v_pointyCornerBottom;
    float pointyRightTop =    (1.0 - v_pointyCornerLeft) * (1.0 - v_pointyCornerBottom);

    // based on where the 3 rounded corners should be, we want to "cut away" certain fragments
    float shouldBeCutAway = sign(
          alphaLeftBottom  * (1.0 - pointyLeftBottom)
        + alphaLeftTop     * (1.0 - pointyLeftTop)
        + alphaRightBottom * (1.0 - pointyRightBottom)
        + alphaRightTop    * (1.0 - pointyRightTop));

    float alpha = mix(ALPHA, 0.0, shouldBeCutAway);
    fragColor = vec4(COLOR, alpha);
}

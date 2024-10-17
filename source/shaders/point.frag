
precision highp float;
precision lowp int;

#if __VERSION__ == 100

    #ifdef GL_EXT_draw_buffers
        #extension GL_EXT_draw_buffers : enable
        #define fragColor gl_FragData[0].rgba
    #else
        #define DRAW_RESTRICTED
        #define fragColor gl_FragColor.rgba
    #endif
#else
    layout(location = 0) out vec4 fragColor;
#endif

#include ./facade.frag.glsl;

varying vec4 v_color;

void main(void)
{
    // Make points round (instead of squares).
    // gl_PointCoord.st ranges from 0.0 to 1.0 across the point horizontally from left to right and
    // vertically from top to bottom.

    float dist = distance(gl_PointCoord, vec2(0.5, 0.5));
    float alpha = v_color.a - step(0.5, dist);

    fragColor = vec4(v_color.xyz, alpha);
}


precision highp float;
precision lowp int;

#if __VERSION__ == 100

    #ifdef GL_EXT_draw_buffers
        #extension GL_EXT_draw_buffers : enable
        #define fragColor gl_FragData[0].rgba
        #define fragId gl_FragData[1].xyzw
    #else
        #define DRAW_RESTRICTED
        #define fragColor gl_FragColor.rgba
        #define fragId gl_FragColor.xyzw
        #define fragDepth gl_FragColor.xyz
    #endif

    #ifdef GL_OES_standard_derivatives
        #extension GL_OES_standard_derivatives : enable
        #define ANTIALIASED_CONTOUR
    #endif

#else
    layout(location = 0) out vec4 fragColor;
    layout(location = 1) out vec4 fragId;
#endif

#include ./facade.frag.glsl;


uniform int u_face;

#ifdef DRAW_RESTRICTED
    #include ./float_pack.glsl;
    uniform int u_attachment;
#endif


varying vec4 v_baseColor;
varying vec4 v_outlineColor;

varying vec4 v_id;
varying vec4 v_uv;


void main(void)
{
#ifdef DRAW_RESTRICTED
    if(u_attachment == 0) {
#endif

    /* Compute the actual outline of a cuboid face based on texture coordinates. */
    vec2 awidth = fwidth(v_uv.st) * v_outlineColor[3];
    vec2 awidth2 = fwidth(v_uv.zw);

    vec4 ctest; /* Used for countour/ctest testing. */
    ctest.xy = step(v_uv.st - awidth.xy, vec2(0.0));
    ctest.zw = step(vec2(1.0), v_uv.st + awidth.xy);
    float outline = clamp(dot(ctest, vec4(1.0)), 0.0, 1.0);

    fragColor = mix(v_baseColor, vec4(v_outlineColor.rgb, 1.0), outline);

#ifdef DRAW_RESTRICTED
    } else if(u_attachment == 1) {
#endif

    fragId = v_id;

#ifdef DRAW_RESTRICTED
    } else if(u_attachment == 2) {
        fragDepth = float24x1_to_uint8x3(gl_FragCoord.z);
    }
#endif
}

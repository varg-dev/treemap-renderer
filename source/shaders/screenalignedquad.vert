
precision highp float;
precision lowp int;

#include ./facade.vert.glsl;
#include ./ndc_offset.glsl;


#if __VERSION__ == 100

#extension GL_EXT_draw_buffers : enable
attribute vec2 a_vertex;
attribute vec3 a_origin;
attribute vec2 a_extent;
attribute vec2 a_offset;
attribute float a_pointyCorner;

#else

in vec2 a_vertex;
in vec3 a_origin;
in vec2 a_extent;
in vec2 a_offset;
in float a_pointyCorner; // pointy corner number as 1: ll, 2: ul, 3: lr, 4: ur

#endif

uniform vec2 u_ndcOffset;
uniform mat4 u_viewProjection;
uniform float u_aspectRatio;

varying float v_radius;
varying vec2 v_uv; // values in range [0, v_extent]
varying vec2 v_extent;
varying float v_pointyCornerLeft; // 0 for right, 1 for left
varying float v_pointyCornerBottom; // 0 for top, 1 for bottom

/**
 * Returns accurate MOD when arguments are approximate integers.
 * Source: https://stackoverflow.com/a/36078859
 */
float modI(float a, float b) {
    float m = a - floor((a + 0.5) / b) * b;
    return floor(m + 0.5);
}

void main(void)
{
    v_pointyCornerLeft = step(a_pointyCorner, 2.0);
    v_pointyCornerBottom = modI(a_pointyCorner, 2.0);

    /* POSITIONING */
    /* quad data as flat array: [0, 0,  0, 1,  1, 0,  1, 1] (a_vertex), which translates to ll, lr, ul, ur corners.
     * 2-------4
     * |  \    |
     * |    \  |
     * 1-------3
     * The current vertex is calculated based on the current quad corners and the extent attributes.
     */

    vec2 extent = a_extent;
    vec2 offset = a_offset;

    // apply more extent to make space for rounded corners (see fragment shader for more information)
    float radius = extent.y * u_aspectRatio * 0.5;
    extent.x += radius;
    offset.x -= mix(radius, 0.0, step(a_pointyCorner, 2.0));

    v_extent = vec2(extent.x, extent.y * u_aspectRatio);
    v_uv = a_vertex * vec2(extent.x, extent.y * u_aspectRatio);
    v_radius = radius;

    vec4 origin = u_viewProjection * vec4(a_origin, 1.0);
    vec2 originNDC = vec2(origin.x / origin.w, origin.y / origin.w);
    vec4 vertex = vec4(originNDC + a_vertex * extent + offset, origin.z/origin.w, 1.0);

    ndcOffset(vertex, u_ndcOffset);
    gl_Position = vertex;
}

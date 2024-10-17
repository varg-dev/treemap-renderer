
#if __VERSION__ == 100
    #extension GL_EXT_draw_buffers : enable
#endif

precision highp float;
precision lowp int;

#include ./facade.vert.glsl;
#include ./ndc_offset.glsl;


#if __VERSION__ == 100

attribute vec2 a_vertex;
attribute vec4 a_layout; /* [ position: vec2, extent: vec2 ] */
attribute vec4 a_id; /* encoded uint32 id in byte4 */
attribute float a_color; /* color index as unsigned byte */
attribute float a_emphasis; /* emphasis mode as unsigned byte */

#else

/* Note: do not use layout location specifier, since they take precedence over CPU managed locations. */
in vec2 a_vertex;
in vec4 a_layout; /* [ position: vec2, extent: vec2 ] */
in vec4 a_id; /* encoded uint32 id in byte4 */
in float a_color; /* color index as unsigned byte */
in float a_emphasis; /* emphasis mode as unsigned byte */

#endif


uniform mat4 u_viewProjection;
uniform vec2 u_ndcOffset;

uniform vec4 u_colorTable[$ColorTableLength];

uniform float u_outlineWidth;
uniform float u_emphasisOutlineWidth;


varying vec4 v_baseColor;
varying vec4 v_outlineColor;
varying vec4 v_id;

varying vec2 v_uv;
varying vec4 v_layout;


const float ONE_OVER_255 = 1.0 / 255.0;

const float OUTLINE_LAMBERT_SCALE = 0.88; /* @todo expose to API */

const int EMPHASIS_COLOR_INDEX = 0;


void main(void)
{
    vec4 emphasisColor = u_colorTable[EMPHASIS_COLOR_INDEX];

    vec4 pos = vec4(a_layout[0], 0.0, a_layout[1], 0.0);
    vec4 ext = vec4(a_layout[2], 0.0, a_layout[3], 1.0);

    vec4 vertex = vec4(a_vertex.x, 0.0, a_vertex.y, 1.0) * ext + pos;

    v_uv = vertex.xz;
    v_layout = a_layout;
    v_id = a_id * ONE_OVER_255;

    vertex = u_viewProjection * vertex;

    /* If emphasis is < 2 use the color lookup, else apply outline color. */
    v_baseColor = mix(u_colorTable[int(a_color)], emphasisColor, step(2.0, a_emphasis));
    v_outlineColor.rgb = mix(v_baseColor.rgb, emphasisColor.rgb, step(1.0, a_emphasis));

    /* The default outline (emphasis = 0.0) should be a little bit darker, when in outline mode (emphasis = 1.0) the
    outline should remain unchanged (except for face lambda), and when highlighting (emphasis = 2.0) the outline is
    lightened a little bit (invere darkening lambda). The mix is utilized to create this. */
    v_outlineColor.rgb *= mix(OUTLINE_LAMBERT_SCALE, (1.0 / OUTLINE_LAMBERT_SCALE), a_emphasis * 0.5);

    /* The outline width is encoded within the alpha channel of the outline (special if emphasized). */
    v_outlineColor[3] = mix(u_emphasisOutlineWidth, u_outlineWidth, step(0.5, abs(a_emphasis - 1.0)));

    ndcOffset(vertex, u_ndcOffset);
    gl_Position = vertex;
}

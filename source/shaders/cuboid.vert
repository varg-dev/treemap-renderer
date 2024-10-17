
#if __VERSION__ == 100
    #extension GL_EXT_draw_buffers : enable
#endif

precision highp float;
precision lowp int;

#include ./facade.vert.glsl;
#include ./ndc_offset.glsl;


#if __VERSION__ == 100

attribute vec3  a_vertex;
attribute vec4  a_layout; /* [ position: vec2, extent: vec2 ] */
attribute vec4  a_id; /* encoded uint32 id in byte4 */
attribute float a_areaScale;
attribute float a_color;
attribute float a_emphasis;
attribute vec2  a_heights; /* [ bottom: float, top: float ] */
attribute vec2  a_texCoord;

#else

/* Note: do not use layout location specifier, since they take precedence over CPU managed locations. */
in vec3  a_vertex;
in vec4  a_layout; /* [ position: vec2, extent: vec2 ] */
in vec4  a_id; /* encoded uint32 id in byte4 */
in float a_areaScale;
in float a_color;
in float a_emphasis;
in vec2  a_heights; /* [ bottom: float, top: float ] */
in vec2  a_texCoord;

#endif


uniform mat4 u_viewProjection;
uniform vec2 u_ndcOffset;

uniform vec4 u_colorTable[$ColorTableLength];

uniform int u_face;
uniform vec4 u_normalAndLambert;

uniform float u_heightScale;
uniform float u_outlineWidth;
uniform float u_emphasisOutlineWidth;

varying vec4 v_baseColor;
varying vec4 v_outlineColor;
varying vec4 v_id;

varying vec4 v_uv;

const float ONE_OVER_255 = 1.0 / 255.0;
const int FACE_INDEX_TOP = 1; /* see CuboidRenderPass.FaceIndex.Top */

const vec3 AMBIENT = vec3(0.0, 0.0, 0.0); /* @todo expose to API */
const float OUTLINE_LAMBERT_SCALE = 0.88; /* @todo expose to API */

const int EMPHASIS_COLOR_INDEX = 0;

/**
 * Transforms the cuboid vertices based on the associated face and height mapping. An earlier implementation of this
 * used the same geometry template and transformed it to either orientation. The current implementation uses a pre-set
 * vertex sequence/orientation and has to adjust the height only.
 * Appart from that, each cuboid face is moved to its position and adjusted to the provided height values. ID, color,
 * and extent along the y-axis are encoded per vertex (or even per face/cuboid) to reduce per-fragment processing.
 */
void main(void)
{
    vec4 emphasisColor = u_colorTable[EMPHASIS_COLOR_INDEX];

    float height = (a_heights[1] - a_heights[0]) * u_heightScale;

    /* Compute the position and extend of the cuboid based on the face. */
    vec4 pos = vec4(a_layout[0], u_face == FACE_INDEX_TOP ?
        a_heights[1] * u_heightScale : a_heights[0] * u_heightScale, a_layout[1], 0.0);
    vec4 ext = vec4(a_layout[2], height, a_layout[3], 1.0);

    /* Area scaling */
    float shrinkage = 1.0 - a_areaScale * ONE_OVER_255;
    pos.x += ext.x * shrinkage * 0.5;
    pos.z += ext.z * shrinkage * 0.5;
    ext.x -= ext.x * shrinkage;
    ext.z -= ext.z * shrinkage;

    /* Compute the final vertex position and pass through texture coordinates and layout data. */
    vec4 vertex = vec4(a_vertex, 1.0) * ext + pos;

    v_uv.st = a_texCoord.st;
    v_id = a_id * ONE_OVER_255;

    /* The y-extent provides world-space height of the cuboid that can be used for fragment-processing. */
    v_uv[2] = 1.0; //mix(a_layout[2], a_layout[3], step(5.0, float(u_face)));
    v_uv[3] = height / mix(a_layout[2], a_layout[3], step(5.0, float(u_face)));


    /* REVIEW AND SIMPLIFY THE FOLLOWING COLOR COMPUTATION (probably to many states) */

    /* If emphasis is < 2 use the color lookup, else apply outline color. */
    int colorIndex = int(abs(a_color - 32.0));
    v_baseColor = mix(u_colorTable[colorIndex], emphasisColor, step(2.0, a_emphasis));

    vertex = u_viewProjection * vertex;

    v_uv[2] *= (a_texCoord.x - 0.5);
    v_uv[3] *= 1.0 - a_texCoord.y;

    v_baseColor = u_colorTable[colorIndex];
    v_baseColor = mix(v_baseColor, emphasisColor, step(2.0, a_emphasis));

    v_outlineColor.rgb = mix(v_baseColor.rgb, emphasisColor.rgb, step(1.0, a_emphasis));

    /* The default outline (emphasis = 0.0) should be a little bit darker, when in outline mode (emphasis = 1.0) the
    outline should remain unchanged (except for face lambda), and when highlighting (emphasis = 2.0) the outline is
    lightened a little bit (invere darkening lambda). The mix is utilized to create this. */
    v_outlineColor.rgb *= mix(OUTLINE_LAMBERT_SCALE, (1.0 / OUTLINE_LAMBERT_SCALE), a_emphasis * 0.5);

    /* The outline should be darkened based on the face orientation. */
    v_outlineColor.rgb = mix(AMBIENT, v_outlineColor.rgb, u_normalAndLambert[3]);
    /* The outline width is encoded within the alpha channel of the outline (special if emphasized). */
    v_outlineColor[3] = mix(u_emphasisOutlineWidth, u_outlineWidth, step(0.5, abs(a_emphasis - 1.0)));

    v_baseColor = mix(vec4(AMBIENT, 1.0), v_baseColor, u_normalAndLambert[3]);

    ndcOffset(vertex, u_ndcOffset);
    gl_Position = vertex;
}

window.onload = () => {
    document.title = __LIB_NAME__;
    document.querySelector('#version').innerHTML = treemaprenderer.version();
    document.querySelector('#branch').innerHTML = treemaprenderer.branch();
    document.querySelector('#commit').innerHTML = treemaprenderer.commit();
    document.querySelector('#cryear').innerHTML = new Date().getFullYear();
    const renderer = treemaprenderer.renderer;
    console.log(`Loeaded Renderer: `, renderer);
};

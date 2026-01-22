(function(){
    const tabs = document.querySelectorAll(".main-tab");
    const prod = document.getElementById("section-prod");
    const views = document.getElementById("section-views");

    tabs.forEach(b=>{
        b.addEventListener("click", ()=>{
            tabs.forEach(x=>x.classList.remove("active"));
            b.classList.add("active");
            const isProd = b.dataset.main === "prod";
            prod.classList.toggle("hidden", !isProd);
            views.classList.toggle("hidden", isProd);
        });
    });
})();

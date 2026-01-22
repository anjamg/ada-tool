(function(){
    function isWeekend(d){ const day=d.getDay(); return day===0 || day===6; }
    function openHour(){ return 9; }
    function closeHour(d){ return isWeekend(d) ? 18 : 19; }

    window.computeNextCallDate = function(baseDate=new Date()){
        let d = new Date(baseDate.getTime() + 3*60*60*1000);

        const open = openHour();
        const close = closeHour(d);

        if(d.getHours() < open) d.setHours(open,0,0,0);
        if(d.getHours() >= close){
            d.setDate(d.getDate()+1);
            d.setHours(open,0,0,0);
        }
        if(d.getDay() === 0){ // dimanche -> lundi
            d.setDate(d.getDate()+1);
            d.setHours(open,0,0,0);
        }
        return d;
    };

    window.toLocalInputValue = function(date){
        return new Date(date.getTime() - date.getTimezoneOffset()*60000)
            .toISOString().slice(0,16);
    };
})();

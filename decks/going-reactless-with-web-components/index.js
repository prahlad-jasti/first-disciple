const template = document.createElement("template");
template.innerHTML = `
<style>
    :host {
        display: flex;
        margin: 50px;
    }
    button {
        width: 100px;
        font-size: 4rem;
        background: #6fbfed; 
        border-radius: 20px;
    }
    span {
        width: 100px;
        padding: 20px;
    }
</style>

<button id="dec"> - </button>
<span id="count"></span>
<button id="inc"> + </button>
`;

class IncDec extends HTMLElement {
    constructor() {
        super();
        
        this.attachShadow({mode: 'open'});

        const el = template.content.cloneNode(true);
        this.shadowRoot.append(el);

        this._count = 0;
    }

    get count() {
        return this._count;
    }

    set count(val) {
        if (val < 0) {
            alert("cannot go less than zero");
            return;
        }

        this._count = val;
        this.shadowRoot.querySelector("#count").innerHTML = this.count;
    }

    connectedCallback() {
        this.count = 0;

        this.shadowRoot.querySelector("#dec").addEventListener("click", () => {
            this.count -= 1;            
        });

        this.shadowRoot.querySelector("#inc").addEventListener("click", () => {
            this.count += 1;            
        });
    }
}


customElements.define("an-incdec", IncDec);

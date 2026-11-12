import test from "node:test";
import assert from "node:assert/strict";
import { getRefreshCookie } from "../src/commn/utils/auth-cookie.js";

test("refresh cookie parser reads the HttpOnly refresh cookie", () => {
    assert.equal(
        getRefreshCookie({ headers: { cookie: "theme=dark; taskverse_refresh=abc123; session=x" } }),
        "abc123"
    );
});

test("refresh cookie parser decodes values and tolerates malformed encodings", () => {
    assert.equal(
        getRefreshCookie({ headers: { cookie: "taskverse_refresh=token%2Evalue" } }),
        "token.value"
    );
    assert.equal(
        getRefreshCookie({ headers: { cookie: "taskverse_refresh=%E0%A4%A" } }),
        "%E0%A4%A"
    );
});

test("refresh cookie parser returns empty string when missing", () => {
    assert.equal(getRefreshCookie({ headers: { cookie: "other=value" } }), "");
    assert.equal(getRefreshCookie({ headers: {} }), "");
});

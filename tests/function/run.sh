# Runs the real Deno wrapper (supabase/functions/assistant/index.ts) against a mock Supabase and a mock OpenAI.
# Needs Deno (https://deno.com) on the PATH, or: DENO="npx deno" bash tests/function/run.sh
HERE=$(cd "$(dirname "$0")" && pwd)
FN="$HERE/../../supabase/functions/assistant"
DENO=${DENO:-deno}
SP=$(mktemp -d)
node "$HERE/mocks.mjs" > "$SP/mocks.log" 2>&1 &
MOCK=$!
sleep 1
run_fn(){ (cd "$FN" && env "$@" $DENO run --allow-net --allow-env --allow-read index.ts > $SP/fn.log 2>&1 &) ; sleep 4; }
stop_fn(){ pkill -f "deno run --allow-net"; sleep 1; }
BASE="SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=anon OPENAI_BASE_URL=http://localhost:54322/v1"
post(){ curl -s -m 20 -X POST http://localhost:8000 -H "Content-Type: application/json" "$@"; echo; }
GOOD='Authorization: Bearer good-token'
echo "== A) normal key"; run_fn $BASE OPENAI_API_KEY=sk-test
echo -n "OPTIONS: "; curl -s -o /dev/null -w "%{http_code} cors=%header{access-control-allow-origin}\n" -X OPTIONS http://localhost:8000
echo -n "GET is refused -> "; curl -s -m 10 http://localhost:8000; echo
echo -n "no token -> "; post -d '{"unit":"1204","message":"hi"}'
echo -n "bad token -> "; post -H "Authorization: Bearer nope" -d '{"unit":"1204","message":"hi"}'
echo -n "good token -> "; post -H "$GOOD" -d '{"unit":"1204","message":"سلام"}'
echo -n "bad json -> "; post -H "$GOOD" -d 'not json'
echo -n "what the model received -> "; curl -s http://localhost:54322/__last; echo
stop_fn
echo "== B) no key configured"; run_fn $BASE; echo -n "-> "; post -H "$GOOD" -d '{"unit":"1204","message":"hi"}'; stop_fn
echo "== C) wrong key"; run_fn $BASE OPENAI_API_KEY=sk-bad; echo -n "-> "; post -H "$GOOD" -d '{"unit":"1204","message":"hi"}'; stop_fn
echo "== D) quota used up"; run_fn $BASE OPENAI_API_KEY=sk-quota; echo -n "-> "; post -H "$GOOD" -d '{"unit":"1204","message":"hi"}'; stop_fn
echo "== E) default model missing: falls back"; run_fn $BASE OPENAI_API_KEY=sk-fallback; echo -n "-> "; post -H "$GOOD" -d '{"unit":"1204","message":"hi"}'; stop_fn
echo "== F) model chosen by secret"; run_fn $BASE OPENAI_API_KEY=sk-test OPENAI_MODEL=my-model; echo -n "-> "; post -H "$GOOD" -d '{"unit":"1204","message":"hi"}'; stop_fn
kill $MOCK 2>/dev/null
echo; grep -i "error" $SP/fn.log | head -3

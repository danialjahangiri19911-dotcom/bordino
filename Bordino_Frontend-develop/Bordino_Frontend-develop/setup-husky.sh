npx husky install

cat <<EOF > .husky/_/pre-commit
#!/bin/sh

echo "=========================="
echo "Running Pre-commit...🚀🚀🚀"
echo "=========================="

npx lint-staged
RESULT=\$?

if [ \$RESULT -ne 0 ]; then
  echo "❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌"
  echo "Pre-commit checks failed!"
  echo "❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌"
  exit 1
fi

echo "✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅"
echo "All pre-commit checks passed successfully."
echo "✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅"

exit 0
EOF

cat <<EOF > .husky/_/pre-push
#!/bin/sh

echo "=========================="
echo "Running pre-push...🚀🚀🚀"
echo "=========================="

yarn tsc --noEmit
yarn test
yarn build
RESULT=\$?

if [ \$RESULT -ne 0 ]; then
  echo "❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌"
  echo "NX Production Build failed."
  echo "❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌"
  exit 1
fi

echo "✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅"
echo "All pre-push checks passed successfully."
echo "✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅"

exit 0
EOF

chmod +x .husky/_/pre-commit
chmod +x .husky/_/pre-push

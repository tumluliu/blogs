for file in *.txt; do 
  mv "$file" "$(basename "$file" .txt).md" 
done

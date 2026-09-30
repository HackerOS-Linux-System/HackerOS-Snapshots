# Classifies `rsync -n -i --delete --out-format='%i %n'` output (dry run new -> old).
# Output:  <kind>TAB/<path>     kind: + added  - deleted  c content changed  m metadata only
{
    item = substr($0, 1, 11)
    name = substr($0, 13)
    sub(/\/$/, "", name)
    if (name == "" || name == ".") next
    if (item ~ /^\*deleting/) { print "-\t/" name; next }
    ftype = substr(item, 2, 1)
    attrs = substr(item, 3, 9)
    if (attrs ~ /^\+\+\+/) { print "+\t/" name; next }
    if (ftype == "d") next                      # directory time/perm noise
    if (substr(attrs, 1, 3) ~ /[cst]/ || substr(item, 1, 1) == "h") { print "c\t/" name; next }
    if (attrs ~ /[pogaxu]/) { print "m\t/" name; next }
}

# go-immutable

The goal of this extension is to aid building immutable data structures in Golang (Go)

## Features
Generates Get and With methods for immutable go data structures

![example1](https://raw.githubusercontent.com/marcus-orchard/go-immutable/main/example1.webp)

**Scalar Fields**    
*Get method* returns the value of the field    
*With method* returns a new copy with the given field value

**Arrays**    
*Num method* Returns the length of the array    
*At method* Returns the item at the given index    
*WithAt method* Returns a new copy with an item at the given index    
*With* Returns a new copy with an item appended to the end    

**Maps**    
*At method* Returns the item at the given key    
*Keys method* Returns all the keys of the map    
*WithAt method* Returns a new copy with an item at the given key

